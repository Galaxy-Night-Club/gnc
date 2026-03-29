import "dotenv/config";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
Client,
GatewayIntentBits,
PermissionFlagsBits,
REST,
Routes,
SlashCommandBuilder
} from "discord.js";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const siteUrl = process.env.GALAXY_SITE_URL || "https://galaxy-night-club.github.io/gnc/";
const reminderHour = Number(process.env.REMINDER_HOUR || "19");
const reminderMinute = Number(process.env.REMINDER_MINUTE || "0");
const reminderTimeZone = process.env.REMINDER_TIMEZONE || "Europe/Paris";
const firebaseServiceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./service-account.json";
const botStatePath = path.join(__dirname, "bot-state.json");

if(!token || !clientId || !guildId){
console.error("Variables Discord manquantes dans .env");
process.exit(1);
}

const client = new Client({
intents: [GatewayIntentBits.Guilds]
});

const commands = [
new SlashCommandBuilder()
.setName("presence-rappel")
.setDescription("Envoie un rappel de presence en MP a un membre")
.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
.addUserOption((option)=>
option
.setName("membre")
.setDescription("Membre a contacter")
.setRequired(true)
)
.addStringOption((option)=>
option
.setName("message")
.setDescription("Message personnalise a ajouter")
.setRequired(false)
),
new SlashCommandBuilder()
.setName("presence-rappel-attente")
.setDescription("Envoie le rappel a tous les comptes encore en attente aujourd'hui")
.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map((command)=> command.toJSON());

const rest = new REST({ version: "10" }).setToken(token);

let db = null;
let reminderTimer = null;
let botState = { lastAutoReminderDate: "" };

function getTimeSnapshot(timeZone = reminderTimeZone){
const parts = new Intl.DateTimeFormat("fr-FR", {
timeZone,
year: "numeric",
month: "2-digit",
day: "2-digit",
hour: "2-digit",
minute: "2-digit",
hourCycle: "h23"
}).formatToParts(new Date()).reduce((accumulator, part)=>{
if(part.type !== "literal"){
accumulator[part.type] = part.value;
}
return accumulator;
}, {});

return {
dateKey: parts.year + "-" + parts.month + "-" + parts.day,
hour: Number(parts.hour),
minute: Number(parts.minute)
};
}

function getServiceAccountFilePath(){
if(!firebaseServiceAccountPath){
return "";
}

return path.isAbsolute(firebaseServiceAccountPath)
? firebaseServiceAccountPath
: path.join(__dirname, firebaseServiceAccountPath);
}

async function loadBotState(){
try{
const content = await readFile(botStatePath, "utf8");
botState = JSON.parse(content);
} catch {
botState = { lastAutoReminderDate: "" };
}
}

async function saveBotState(){
await writeFile(botStatePath, JSON.stringify(botState, null, 2), "utf8");
}

async function initFirebaseAdmin(){
if(db){
return db;
}

let serviceAccount = null;
const rawJson = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
if(rawJson){
try{
serviceAccount = JSON.parse(rawJson);
if(serviceAccount.private_key){
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
}
} catch (error){
console.error("FIREBASE_SERVICE_ACCOUNT_JSON est invalide :", error);
return null;
}
} else {
const accountPath = getServiceAccountFilePath();
if(accountPath && existsSync(accountPath)){
try{
serviceAccount = JSON.parse(await readFile(accountPath, "utf8"));
} catch (error){
console.error("Impossible de lire le service account Firebase :", error);
return null;
}
}
}

if(!serviceAccount){
console.warn("Firebase Admin n'est pas encore configure. Le rappel automatique des comptes en attente restera en veille.");
return null;
}

if(!getApps().length){
initializeApp({
credential: cert(serviceAccount)
});
}

db = getFirestore();
return db;
}

async function registerCommands(){
await rest.put(
Routes.applicationGuildCommands(clientId, guildId),
{ body: commands }
);
}

function buildPresenceMessage(target, customMessage){
const intro = customMessage || "Tu n'as pas encore repondu a la presence d'aujourd'hui.";
return [
"Rappel Presence - vote requis !",
"",
"Bonjour " + (target.displayName || target.username || "staff") + " !",
"",
intro,
"",
"Il te reste un peu de temps pour te connecter sur le site et confirmer ta presence ou ton absence.",
"",
"Rendez-vous sur le site -> Presence",
siteUrl,
"",
"Sans reponse, ton statut restera en attente."
].join("\n");
}

function isValidDiscordId(value){
return /^\d{16,20}$/.test(String(value || "").trim());
}

async function sendReminderToDiscordId(discordId, target, customMessage){
const discordUser = await client.users.fetch(discordId);
const dm = await discordUser.createDM();
await dm.send(buildPresenceMessage(target, customMessage));
return discordUser;
}

async function getPendingPresenceTargets(dateKey){
const firestore = await initFirebaseAdmin();
if(!firestore){
return {
ok: false,
reason: "firebase_missing",
pendingTargets: []
};
}

const [staffSnapshot, presenceSnapshot] = await Promise.all([
firestore.collection("staffProfiles").get(),
firestore.collection("presenceEntries").where("date", "==", dateKey).get()
]);

const staffProfiles = staffSnapshot.docs.map((doc)=> doc.data()).filter((profile)=> profile && profile.active !== false);
const presenceMap = new Map(presenceSnapshot.docs.map((doc)=> {
const data = doc.data();
return [data.username, data];
}));

const pendingTargets = staffProfiles.filter((profile)=>{
const entry = presenceMap.get(profile.username);
return !entry || entry.status === "pending";
});

return {
ok: true,
reason: "",
pendingTargets
};
}

async function sendPendingPresenceReminders({ dateKey = getTimeSnapshot().dateKey, source = "manual" } = {}){
const pendingResult = await getPendingPresenceTargets(dateKey);
if(!pendingResult.ok){
return {
ok: false,
dateKey,
source,
sent: 0,
skipped: 0,
failed: 0,
details: ["Firebase Admin n'est pas configure cote bot."]
};
}

const summary = {
ok: true,
dateKey,
source,
sent: 0,
skipped: 0,
failed: 0,
details: []
};

for(const target of pendingResult.pendingTargets){
if(!isValidDiscordId(target.discordId)){
summary.skipped += 1;
summary.details.push((target.displayName || target.username) + " : Discord ID manquant.");
continue;
}

try{
await sendReminderToDiscordId(target.discordId, target);
summary.sent += 1;
summary.details.push((target.displayName || target.username) + " : MP envoye.");
} catch (error){
summary.failed += 1;
summary.details.push((target.displayName || target.username) + " : envoi impossible.");
console.error("Erreur envoi MP Discord :", error);
}
}

if(!pendingResult.pendingTargets.length){
summary.details.push("Aucun compte en attente pour " + dateKey + ".");
}

return summary;
}

function formatReminderSummary(result){
const lines = [
"Date : " + result.dateKey,
"Envoyes : " + result.sent,
"Ignores : " + result.skipped,
"Echecs : " + result.failed
];

if(result.details.length){
lines.push("");
lines.push(result.details.join("\n"));
}

return lines.join("\n");
}

async function runAutomaticReminderTick(){
const snapshot = getTimeSnapshot();
if(snapshot.hour !== reminderHour || snapshot.minute !== reminderMinute){
return;
}

if(botState.lastAutoReminderDate === snapshot.dateKey){
return;
}

const result = await sendPendingPresenceReminders({
dateKey: snapshot.dateKey,
source: "auto"
});

if(result.ok){
botState.lastAutoReminderDate = snapshot.dateKey;
await saveBotState();
console.log("[presence-auto]", formatReminderSummary(result));
} else {
console.warn("[presence-auto] rappel saute :", result.details.join(" | "));
}
}

function startReminderLoop(){
if(reminderTimer){
clearInterval(reminderTimer);
}

reminderTimer = setInterval(()=>{
runAutomaticReminderTick().catch((error)=>{
console.error("Tick de rappel auto en erreur :", error);
});
}, 30_000);
}

client.once("clientReady", async ()=>{
await loadBotState();
startReminderLoop();
console.log("Bot connecte en tant que " + client.user.tag);
console.log("Rappel auto programme a " + String(reminderHour).padStart(2, "0") + ":" + String(reminderMinute).padStart(2, "0") + " (" + reminderTimeZone + ")");
});

client.on("interactionCreate", async (interaction)=>{
if(!interaction.isChatInputCommand()){
return;
}

try{
if(interaction.commandName === "presence-rappel"){
const member = interaction.options.getUser("membre", true);
const customMessage = interaction.options.getString("message") || undefined;

try{
await sendReminderToDiscordId(member.id, { displayName: member.username, username: member.username }, customMessage);
await interaction.reply({
content: "Rappel envoye en MP a " + member.username + ".",
ephemeral: true
});
} catch (error){
console.error("Erreur envoi MP Discord :", error);
await interaction.reply({
content: "Impossible d'envoyer le MP a " + member.username + ". Verifie ses MP ou reessaie.",
ephemeral: true
});
}
return;
}

if(interaction.commandName === "presence-rappel-attente"){
await interaction.deferReply({ ephemeral: true });
const result = await sendPendingPresenceReminders({ source: "manual" });
await interaction.editReply({
content: formatReminderSummary(result)
});
return;
}
} catch (error){
console.error("Erreur interaction Discord :", error);
try{
if(interaction.deferred || interaction.replied){
await interaction.editReply({
content: "Une erreur est arrivee pendant la commande. Regarde les logs du bot."
});
} else {
await interaction.reply({
content: "Une erreur est arrivee pendant la commande. Regarde les logs du bot.",
ephemeral: true
});
}
} catch (replyError){
console.error("Erreur reponse Discord apres echec :", replyError);
}
}
});

await registerCommands();
await initFirebaseAdmin();
await client.login(token);
