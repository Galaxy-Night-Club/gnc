const defaultUsers = [
{ username: "adrian", email: "adrian@galaxynightclub.com", password: "galaxyboss", role: "boss", department: "all", displayName: "Adrian" },
{ username: "grace", email: "grace@galaxynightclub.com", password: "barboss", role: "manager", department: "bar", displayName: "Grace" },
{ username: "logan", email: "logan@galaxynightclub.com", password: "secureboss", role: "manager", department: "security", displayName: "Logan" }
];

const storageKeys = {
users: "galaxyUsers",
session: "galaxyCurrentUser",
pointages: "galaxyPointages",
theme: "galaxyTheme"
};

const departments = { bar: "Bar", security: "Securite", dj: "DJ", dance: "Danseur / danseuse", all: "Tous les poles" };
const statuses = { absent: "Absent", "en-service": "En service", "fin-service": "Fin de service" };
const adminUsernames = ["adrian", "grace", "logan"];

let currentUser = null;
let editingUsername = null;
let selectedPointageUser = null;

function makeId(){
return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function getPhotoStorageKey(slot){
return "galaxyPhoto_" + slot;
}

function getSectionStorageKey(sectionId){
return "galaxySection_" + sectionId;
}

function getCardDescriptionStorageKey(slot){
return "galaxyCardDescription_" + slot;
}

function getPhotoSlots(){
const slots = new Set(["adrian", "grace", "logan"]);
getUsers().forEach((user)=>{
if(user.username){
slots.add(user.username);
}
});
return Array.from(slots);
}

function applyTheme(theme){
const resolvedTheme = theme === "dark" ? "dark" : "light";
document.body.dataset.theme = resolvedTheme;
const lightButton = document.getElementById("themeLightBtn");
const darkButton = document.getElementById("themeDarkBtn");
if(lightButton){
lightButton.classList.toggle("active-theme", resolvedTheme === "light");
}
if(darkButton){
darkButton.classList.toggle("active-theme", resolvedTheme === "dark");
}
}

function restoreTheme(){
applyTheme(localStorage.getItem(storageKeys.theme) || "light");
}

function changeTheme(theme){
const nextTheme = theme === "dark" ? "dark" : "light";
localStorage.setItem(storageKeys.theme, nextTheme);
applyTheme(nextTheme);
}

function seedUsers(){
const existingUsers = JSON.parse(localStorage.getItem(storageKeys.users) || "[]");

if(!existingUsers.length){
localStorage.setItem(storageKeys.users, JSON.stringify(defaultUsers));
return;
}

const systemUsernames = defaultUsers.map((user)=> user.username);
const preservedCustomUsers = existingUsers.filter((user)=> !systemUsernames.includes(user.username) && user.username !== "patron" && user.username !== "luna" && user.username !== "neo");
localStorage.setItem(storageKeys.users, JSON.stringify([...defaultUsers, ...preservedCustomUsers]));
}

function seedPointages(){
if(localStorage.getItem(storageKeys.pointages)){ return; }
const demoPointages = [
{ id: makeId(), nom: "Grace", entree: "17:30", sortie: "02:15", savedAt: "26/03/2026 17:35", createdBy: "grace", department: "bar", status: "en-service" },
{ id: makeId(), nom: "Logan", entree: "18:30", sortie: "03:00", savedAt: "26/03/2026 18:32", createdBy: "logan", department: "security", status: "fin-service" }
];
localStorage.setItem(storageKeys.pointages, JSON.stringify(demoPointages));
}

function getUsers(){ return JSON.parse(localStorage.getItem(storageKeys.users) || "[]"); }
function setUsers(users){ localStorage.setItem(storageKeys.users, JSON.stringify(users)); }
function getPointages(){ return JSON.parse(localStorage.getItem(storageKeys.pointages) || "[]"); }
function setPointages(pointages){ localStorage.setItem(storageKeys.pointages, JSON.stringify(pointages)); }

function getEmailLocalPart(email){
return (email || "").trim().toLowerCase().split("@")[0];
}

function getUserEmail(user){
return user.email || (user.username + "@galaxynightclub.com");
}

function getDepartmentLabel(department){ return departments[department] || department; }
function getStatusLabel(status){ return statuses[status] || status; }

function getPointageMinutes(pointage){
if(!pointage || !pointage.entree || !pointage.sortie || pointage.entree === "-" || pointage.sortie === "-"){
return 0;
}

const [startHours, startMinutes] = pointage.entree.split(":").map(Number);
const [endHours, endMinutes] = pointage.sortie.split(":").map(Number);

if([startHours, startMinutes, endHours, endMinutes].some((value)=> Number.isNaN(value))){
return 0;
}

let startTotal = startHours * 60 + startMinutes;
let endTotal = endHours * 60 + endMinutes;

if(endTotal < startTotal){
endTotal += 24 * 60;
}

return Math.max(0, endTotal - startTotal);
}

function formatDuration(totalMinutes){
const hours = Math.floor(totalMinutes / 60);
const minutes = totalMinutes % 60;
return hours + "h" + String(minutes).padStart(2, "0");
}

function hasAdminAccess(){
if(!currentUser){ return false; }
const username = (currentUser.username || "").toLowerCase();
const emailLocalPart = getEmailLocalPart(currentUser.email || "");
return currentUser.role === "boss" || currentUser.role === "manager" || adminUsernames.includes(username) || adminUsernames.includes(emailLocalPart);
}

function canManageAll(){ return hasAdminAccess(); }
function canManageStaff(){ return hasAdminAccess(); }

function saveSectionContent(sectionId){
const field = document.getElementById(sectionId);
if(field){
localStorage.setItem(getSectionStorageKey(sectionId), field.value);
}
}

function loadSavedSections(){
[
"adrian_infosContent",
"adrian_numerosContent",
"adrian_gradeContent",
"adrian_roleContent",
"adrian_notesContent",
"adrian_accesContent",
"grace_infosContent",
"grace_numerosContent",
"grace_gradeContent",
"grace_roleContent",
"grace_notesContent",
"grace_accesContent",
"logan_infosContent",
"logan_numerosContent",
"logan_gradeContent",
"logan_roleContent",
"logan_notesContent",
"logan_accesContent",
"docs_reglementContent",
"docs_ouvertureContent",
"docs_fermetureContent",
"docs_barContent",
"docs_securityContent",
"docs_djContent",
"docs_danceContent",
"docs_managersContent"
].forEach((sectionId)=>{
const field = document.getElementById(sectionId);
const savedValue = localStorage.getItem(getSectionStorageKey(sectionId));
if(field && savedValue !== null){
field.value = savedValue;
}
});
}

function getSavedSectionValue(sectionId, fallbackValue){
const savedValue = localStorage.getItem(getSectionStorageKey(sectionId));
return savedValue !== null ? savedValue : fallbackValue;
}

function openPhotoPicker(slot){
const input = document.getElementById("photo-input-" + slot);
if(input){
input.click();
}
}

function handlePhotoUpload(slot, event){
const file = event.target.files && event.target.files[0];
if(!file){ return; }

const reader = new FileReader();
reader.onload = () => {
const imageUrl = reader.result;
localStorage.setItem(getPhotoStorageKey(slot), imageUrl);
const image = document.getElementById("photo-" + slot);
if(image){
image.src = imageUrl;
}
};
reader.readAsDataURL(file);
}

function loadSavedPhotos(){
getPhotoSlots().forEach((slot)=>{
const savedPhoto = localStorage.getItem(getPhotoStorageKey(slot));
const image = document.getElementById("photo-" + slot);
if(savedPhoto && image){
image.src = savedPhoto;
}
});
}

function loadSavedCardDescriptions(){
getPhotoSlots().forEach((slot)=>{
const savedDescription = localStorage.getItem(getCardDescriptionStorageKey(slot));
const display = document.getElementById("card-description-" + slot);
const input = document.getElementById("card-description-input-" + slot);
if(savedDescription){
if(display){
display.innerText = savedDescription;
}
if(input){
input.value = savedDescription;
}
}
});
}

function saveCardDescription(slot){
if(!currentUser || currentUser.username !== "adrian"){
return;
}

const input = document.getElementById("card-description-input-" + slot);
const display = document.getElementById("card-description-" + slot);
if(!input || !display){
return;
}

localStorage.setItem(getCardDescriptionStorageKey(slot), input.value);
display.innerText = input.value;
}

function getUserProfileFromEmail(email){
const loweredEmail = (email || "").trim().toLowerCase();
const localPart = getEmailLocalPart(loweredEmail);
return getUsers().find((entry)=> (entry.email && entry.email.toLowerCase() === loweredEmail) || entry.username === localPart) || null;
}

function login(event){
if(event){
event.preventDefault();
}

const email = document.getElementById("username").value.trim().toLowerCase();
const password = document.getElementById("password").value.trim();
const loginMsg = document.getElementById("loginMsg");
const profile = getUserProfileFromEmail(email);

if(!profile || profile.password !== password){
loginMsg.className = "status-msg error";
loginMsg.innerText = "Connexion impossible. Verifie l'email et le mot de passe.";
return;
}

currentUser = profile;
localStorage.setItem(storageKeys.session, JSON.stringify(profile));
loginMsg.className = "status-msg success";
loginMsg.innerText = "Connexion locale reussie.";
renderApp();
}

function logout(){
currentUser = null;
editingUsername = null;
localStorage.removeItem(storageKeys.session);
document.getElementById("appShell").classList.add("hidden");
document.getElementById("loginScreen").classList.remove("hidden");
document.getElementById("loginMsg").innerText = "";
document.getElementById("password").value = "";
}

function restoreSession(){
const savedUser = localStorage.getItem(storageKeys.session);
if(!savedUser){ return; }
currentUser = JSON.parse(savedUser);
renderApp();
}

function getScopeUsers(){ return getUsers().filter((user)=> canManageAll() || user.username === currentUser.username); }
function getVisiblePointages(){ return getPointages().filter((pointage)=> canManageAll() || pointage.createdBy === currentUser.username); }

function getRoleLabel(user){
if(user.role === "boss"){ return "Patron"; }
if(user.role === "manager"){ return "Responsable"; }
return "Staff";
}

function getGroupCountLabel(count){
return count + " profil" + (count > 1 ? "s" : "");
}

function renderDashboardHierarchy(){
const users = getUsers();
const coreUsernames = ["adrian", "grace", "logan"];
const extraUsers = users.filter((user)=> !coreUsernames.includes(user.username));
const directionUsers = users.filter((user)=> user.username === "adrian" || user.department === "all");
const barUsers = users.filter((user)=> user.username === "grace" || user.department === "bar");
const securityUsers = users.filter((user)=> user.username === "logan" || user.department === "security");
const djUsers = users.filter((user)=> user.department === "dj");
const danceUsers = users.filter((user)=> user.department === "dance");

document.getElementById("directionCount").innerText = getGroupCountLabel(directionUsers.length);
document.getElementById("barCount").innerText = getGroupCountLabel(barUsers.length);
document.getElementById("securityCount").innerText = getGroupCountLabel(securityUsers.length);
document.getElementById("djCount").innerText = getGroupCountLabel(djUsers.length);
document.getElementById("danceCount").innerText = getGroupCountLabel(danceUsers.length);

const sections = [
{ id: "directionExtraCards", panelId: "directionExtraPanels", department: "all" },
{ id: "barExtraCards", panelId: "barExtraPanels", department: "bar" },
{ id: "securityExtraCards", panelId: "securityExtraPanels", department: "security" },
{ id: "djExtraCards", panelId: "djExtraPanels", department: "dj" },
{ id: "danceExtraCards", panelId: "danceExtraPanels", department: "dance" }
];

sections.forEach((section)=>{
const container = document.getElementById(section.id);
const panelContainer = document.getElementById(section.panelId);
const scopedUsers = extraUsers.filter((user)=> user.department === section.department);

if(!scopedUsers.length){
container.innerHTML = "";
panelContainer.innerHTML = "";
container.classList.add("hidden");
panelContainer.classList.add("hidden");
return;
}

container.classList.remove("hidden");
panelContainer.classList.remove("hidden");
container.innerHTML = scopedUsers.map((user)=> {
const roleLabel = getRoleLabel(user);
const defaultDescription = roleLabel === "Responsable" ? "Responsable du pole " + getDepartmentLabel(user.department).toLowerCase() + "." : "Membre du staff du pole " + getDepartmentLabel(user.department).toLowerCase() + ".";
const description = localStorage.getItem(getCardDescriptionStorageKey(user.username)) || defaultDescription;
const savedPhoto = localStorage.getItem(getPhotoStorageKey(user.username)) || "image.png";
return "<article class='person-card hierarchy-person-card dynamic-person-card' data-person='" + user.username + "' onclick=\"showStaffCard('" + user.username + "')\"><img id='photo-" + user.username + "' src='" + savedPhoto + "' alt='" + user.displayName + "' class='person-photo hierarchy-photo'><input id='photo-input-" + user.username + "' class='photo-input hidden' type='file' accept='image/*' onchange=\"handlePhotoUpload('" + user.username + "', event)\"><strong>" + user.displayName + "</strong><span class='dept-badge'>" + roleLabel + "</span><p id='card-description-" + user.username + "'>" + description + "</p><div class='card-editor hidden' onclick='event.stopPropagation()'><textarea id='card-description-input-" + user.username + "' class='card-description-input' placeholder='Petite description de la carte'>" + description + "</textarea><button class='secondary-btn mini-card-btn' onclick=\"saveCardDescription('" + user.username + "')\">Enregistrer</button><button class='secondary-btn mini-card-btn' onclick=\"openPhotoPicker('" + user.username + "')\">Photo</button></div></article>";
}).join("");

panelContainer.innerHTML = scopedUsers.map((user)=> {
const roleLabel = getRoleLabel(user);
return "<div id='staff-panel-" + user.username + "' class='staff-detail-panel hidden'><div class='dashboard-mini-grid'><article class='mini-info-card editable-card'><strong>📸 Photo</strong><button class='secondary-btn photo-btn' onclick=\"openPhotoPicker('" + user.username + "')\">Choisir une photo</button></article><article class='mini-info-card editable-card'><strong>📝 Informations</strong><textarea id='" + user.username + "_infosContent' class='mini-editor'>" + getSavedSectionValue(user.username + "_infosContent", "Informations internes pour " + user.displayName + ".") + "</textarea><button class='secondary-btn save-section-btn' onclick=\"saveSectionContent('" + user.username + "_infosContent')\">Enregistrer</button></article><article class='mini-info-card editable-card'><strong>📞 Numeros</strong><textarea id='" + user.username + "_numerosContent' class='mini-editor'>" + getSavedSectionValue(user.username + "_numerosContent", "Numeros utiles pour " + user.displayName + ".") + "</textarea><button class='secondary-btn save-section-btn' onclick=\"saveSectionContent('" + user.username + "_numerosContent')\">Enregistrer</button></article><article class='mini-info-card editable-card'><strong>🎖 Grade</strong><textarea id='" + user.username + "_gradeContent' class='mini-editor'>" + getSavedSectionValue(user.username + "_gradeContent", roleLabel) + "</textarea><button class='secondary-btn save-section-btn' onclick=\"saveSectionContent('" + user.username + "_gradeContent')\">Enregistrer</button></article><article class='mini-info-card editable-card'><strong>🧭 Role</strong><textarea id='" + user.username + "_roleContent' class='mini-editor'>" + getSavedSectionValue(user.username + "_roleContent", "Role de " + user.displayName + " au sein du pole " + getDepartmentLabel(user.department).toLowerCase() + ".") + "</textarea><button class='secondary-btn save-section-btn' onclick=\"saveSectionContent('" + user.username + "_roleContent')\">Enregistrer</button></article><article class='mini-info-card editable-card'><strong>📌 Notes</strong><textarea id='" + user.username + "_notesContent' class='mini-editor'>" + getSavedSectionValue(user.username + "_notesContent", "Notes internes pour " + user.displayName + ".") + "</textarea><button class='secondary-btn save-section-btn' onclick=\"saveSectionContent('" + user.username + "_notesContent')\">Enregistrer</button></article><article class='mini-info-card editable-card'><strong>🔐 Acces</strong><textarea id='" + user.username + "_accesContent' class='mini-editor'>" + getSavedSectionValue(user.username + "_accesContent", "Acces defini selon le role et le secteur.") + "</textarea><button class='secondary-btn save-section-btn' onclick=\"saveSectionContent('" + user.username + "_accesContent')\">Enregistrer</button></article></div></div>";
}).join("");
});
}

function canManageUser(targetUser){
if(!targetUser){ return false; }
if(canManageAll()){
if(currentUser.username === "adrian"){
return true;
}
return targetUser.role !== "boss";
}
return false;
}

function updatePointageFormState(){
const nameInput = document.getElementById("nom");
if(currentUser.role === "staff"){
nameInput.value = currentUser.displayName;
nameInput.readOnly = true;
nameInput.placeholder = currentUser.displayName;
return;
}
nameInput.readOnly = false;
nameInput.placeholder = "Nom du membre du staff";
nameInput.value = "";
}

function renderHierarchyDetails(){
const container = document.getElementById("hierarchieDetails");
if(!container){ return; }
const users = getUsers().filter((user)=> user.role !== "boss");
container.innerHTML = users.map((user)=> "<div class='hierarchy-item'><span class='dept-badge'>" + getDepartmentLabel(user.department) + "</span><strong>" + user.displayName + "</strong><div class='staff-meta'>Role : " + getRoleLabel(user) + "<br>Email : " + getUserEmail(user) + "</div></div>").join("");
}

function renderPointages(){
const container = document.getElementById("pointagesList");
const detailContainer = document.getElementById("pointagePersonDetail");
if(!container){ return; }

const nameFilter = document.getElementById("filterEmployee").value.trim().toLowerCase();
const departmentFilter = document.getElementById("filterDepartment").value;
const statusFilter = document.getElementById("filterStatus").value;

const visiblePointages = getVisiblePointages().filter((item)=>{
const matchesName = !nameFilter || item.nom.toLowerCase().includes(nameFilter);
const matchesDepartment = !departmentFilter || item.department === departmentFilter;
const matchesStatus = !statusFilter || item.status === statusFilter;
return matchesName && matchesDepartment && matchesStatus;
});

if(!visiblePointages.length){
container.innerHTML = "<div class='pointage-item'><strong>Aucun pointage</strong><div class='pointage-meta'>Aucun enregistrement disponible dans ton perimetre.</div></div>";
if(detailContainer){
detailContainer.classList.add("hidden");
detailContainer.innerHTML = "";
}
return;
}

const groupedPointages = Object.values(visiblePointages.reduce((acc, item)=>{
const key = item.createdBy || item.nom;
if(!acc[key]){
acc[key] = {
key,
nom: item.nom,
department: item.department,
pointages: [],
totalMinutes: 0
};
}
acc[key].pointages.push(item);
acc[key].totalMinutes += getPointageMinutes(item);
return acc;
}, {})).sort((first, second)=> first.nom.localeCompare(second.nom, "fr"));

const hasSelectedUser = selectedPointageUser && groupedPointages.some((group)=> group.key === selectedPointageUser);
if(!hasSelectedUser){
selectedPointageUser = groupedPointages[0].key;
}

container.innerHTML = groupedPointages.map((group)=>{
const latestPointage = group.pointages[0];
const isActive = group.key === selectedPointageUser;
return "<div class='pointage-item pointage-summary-card" + (isActive ? " active-pointage" : "") + "' onclick=\"showPointagePerson('" + group.key + "')\"><div class='pointage-summary-top'><div><span class='dept-badge'>" + getDepartmentLabel(group.department) + "</span> <span class='status-badge " + latestPointage.status + "'>" + getStatusLabel(latestPointage.status) + "</span></div><span class='pointage-total-badge'>Total " + formatDuration(group.totalMinutes) + "</span></div><strong>" + group.nom + "</strong><div class='pointage-meta'>" + group.pointages.length + " pointage(s)<br>Dernier enregistrement : " + latestPointage.savedAt + "</div></div>";
}).join("");

const activeGroup = groupedPointages.find((group)=> group.key === selectedPointageUser) || null;
if(!activeGroup){
detailContainer.classList.add("hidden");
detailContainer.innerHTML = "";
return;
}

detailContainer.classList.remove("hidden");
detailContainer.innerHTML =
"<p class='eyebrow'>Detail pointages</p>" +
"<h2>" + activeGroup.nom + "</h2>" +
"<p>Total cumule : <strong>" + formatDuration(activeGroup.totalMinutes) + "</strong> sur " + activeGroup.pointages.length + " service(s).</p>" +
"<div class='pointage-detail-list'>" +
activeGroup.pointages.map((item)=>{
const deleteBtn = (canManageAll() || item.createdBy === currentUser.username) ? "<button class='danger-btn' onclick=\"deletePointage('" + item.id + "')\">Supprimer</button>" : "";
const durationLabel = formatDuration(getPointageMinutes(item));
return "<div class='pointage-detail-item'><div class='pointage-detail-head'><div><span class='dept-badge'>" + getDepartmentLabel(item.department) + "</span> <span class='status-badge " + item.status + "'>" + getStatusLabel(item.status) + "</span></div><span class='pointage-total-badge'>Duree " + durationLabel + "</span></div><strong>" + item.nom + "</strong><div class='pointage-meta'>Arrivee : " + item.entree + "<br>Sortie : " + item.sortie + "<br>Enregistre le : " + item.savedAt + "</div><div class='staff-actions'>" + deleteBtn + "</div></div>";
}).join("") +
"</div>";
}

function findUserByName(name){
return getUsers().find((user)=> user.displayName.toLowerCase() === name.toLowerCase());
}

function savePointage(){
if(!currentUser){ return; }
const nameInput = document.getElementById("nom");
const entree = document.getElementById("heure-entree").value;
const sortie = document.getElementById("heure-sortie").value;
const status = document.getElementById("pointageStatus").value;
const message = document.getElementById("saveMsg");
const nom = currentUser.role === "staff" ? currentUser.displayName : nameInput.value.trim();

if(!nom){
message.innerText = "Merci de choisir un membre du staff.";
return;
}
if(status !== "absent" && !entree){
message.innerText = "Merci de renseigner une heure d'arrivee.";
return;
}

const targetUser = findUserByName(nom);
if(!targetUser){
message.innerText = "Ce membre n'existe pas dans le staff.";
return;
}

if(currentUser.role === "staff" && targetUser.username !== currentUser.username){
message.innerText = "Tu ne peux pointer que ton propre compte.";
return;
}

const pointages = getPointages();
pointages.unshift({
id: makeId(),
nom: targetUser.displayName,
entree: status === "absent" ? "-" : entree,
sortie: sortie || "-",
savedAt: new Date().toLocaleString("fr-FR"),
createdBy: targetUser.username,
department: targetUser.department,
status: status
});
setPointages(pointages);

message.innerText = "Pointage enregistre pour " + targetUser.displayName + ".";
document.getElementById("heure-entree").value = "";
document.getElementById("heure-sortie").value = "";
document.getElementById("pointageStatus").value = "en-service";
updatePointageFormState();
renderPointages();
}

function deletePointage(id){
const pointage = getPointages().find((item)=> item.id === id);
if(!pointage || (!canManageAll() && pointage.createdBy !== currentUser.username)){ return; }
setPointages(getPointages().filter((item)=> item.id !== id));
renderPointages();
}

function showPointagePerson(username){
selectedPointageUser = username;
renderPointages();
}

function resetStaffForm(clearMessage){
editingUsername = null;
document.getElementById("newDisplayName").value = "";
document.getElementById("newEmail").value = "";
document.getElementById("newPassword").value = "";
document.getElementById("newEmail").readOnly = false;
document.getElementById("newRole").value = "staff";
document.getElementById("newDepartment").value = canManageAll() ? "bar" : currentUser ? currentUser.department : "bar";
document.getElementById("staffSubmitBtn").innerText = "Ajouter le compte";
document.getElementById("staffCancelBtn").classList.add("hidden");
if(clearMessage){
document.getElementById("staffMsg").innerText = "";
}
}

function renderStaffList(){
const container = document.getElementById("staffList");
if(!container){ return; }
const visibleUsers = getScopeUsers().filter((user)=> user.role !== "boss");
if(!visibleUsers.length){
container.innerHTML = "<div class='staff-item'><strong>Aucun employe</strong><div class='staff-meta'>Aucun compte visible dans ton perimetre.</div></div>";
return;
}

container.innerHTML = visibleUsers.map((user)=>{
const editButton = canManageUser(user) ? "<button class='secondary-btn' onclick=\"editStaff('" + user.username + "')\">Modifier</button>" : "";
const deleteButton = canManageUser(user) ? "<button class='danger-btn' onclick=\"deleteStaff('" + user.username + "')\">Supprimer</button>" : "";
return "<div class='staff-item'><span class='dept-badge'>" + getDepartmentLabel(user.department) + "</span><strong>" + user.displayName + "</strong><div class='staff-meta'>Email : " + getUserEmail(user) + "<br>Role : " + getRoleLabel(user) + "</div><div class='staff-actions'>" + editButton + deleteButton + "</div></div>";
}).join("");
}

function addStaff(){
if(!canManageStaff()){ return; }
const displayName = document.getElementById("newDisplayName").value.trim();
const email = document.getElementById("newEmail").value.trim().toLowerCase();
const username = getEmailLocalPart(email);
const password = document.getElementById("newPassword").value.trim();
const role = canManageAll() ? document.getElementById("newRole").value : "staff";
const department = canManageAll() ? document.getElementById("newDepartment").value : currentUser.department;
const message = document.getElementById("staffMsg");

if(!displayName || !email || !password){
message.innerText = "Merci de remplir tous les champs du nouveau compte.";
return;
}

const users = getUsers();
if(users.some((user)=> user.username === username || (user.email && user.email.toLowerCase() === email))){
message.innerText = "Cet email existe deja.";
return;
}

users.push({ username, email, password, role, department, displayName });
setUsers(users);
message.innerText = "Compte cree pour " + displayName + ".";
resetStaffForm(true);
renderStaffList();
}

function editStaff(username){
const targetUser = getUsers().find((user)=> user.username === username);
if(!canManageUser(targetUser)){ return; }
editingUsername = username;
document.getElementById("newDisplayName").value = targetUser.displayName;
document.getElementById("newEmail").value = getUserEmail(targetUser);
document.getElementById("newPassword").value = targetUser.password;
document.getElementById("newRole").value = targetUser.role;
document.getElementById("newDepartment").value = targetUser.department;
document.getElementById("newEmail").readOnly = false;
document.getElementById("staffSubmitBtn").innerText = "Modifier le compte";
document.getElementById("staffCancelBtn").classList.remove("hidden");
document.getElementById("staffMsg").innerText = "Mode modification actif pour " + targetUser.displayName + ".";
}

function updateStaff(){
const users = getUsers();
const targetUser = users.find((user)=> user.username === editingUsername);
if(!canManageUser(targetUser)){ return; }

const displayName = document.getElementById("newDisplayName").value.trim();
const email = document.getElementById("newEmail").value.trim().toLowerCase();
const password = document.getElementById("newPassword").value.trim();
const role = document.getElementById("newRole").value;
const department = document.getElementById("newDepartment").value;
const message = document.getElementById("staffMsg");

if(!displayName || !email || !password){
message.innerText = "Merci de remplir les champs obligatoires.";
return;
}
const nextUsername = getEmailLocalPart(email);
if(users.some((user)=> user.username !== editingUsername && (user.username === nextUsername || (user.email && user.email.toLowerCase() === email)))){
message.innerText = "Cette adresse mail existe deja.";
return;
}
const previousUsername = targetUser.username;

targetUser.displayName = displayName;
targetUser.email = email;
targetUser.username = nextUsername;
targetUser.password = password;
targetUser.role = role;
targetUser.department = department;
setUsers(users);

setPointages(getPointages().map((item)=> item.createdBy === previousUsername ? { ...item, nom: displayName, department: department, createdBy: nextUsername } : item));

if(currentUser.username === previousUsername){
currentUser = targetUser;
localStorage.setItem(storageKeys.session, JSON.stringify(targetUser));
}

message.innerText = "Compte modifie pour " + displayName + ".";
resetStaffForm(true);
renderStaffList();
}

function submitStaffForm(){
if(editingUsername){
updateStaff();
return;
}
addStaff();
}

function cancelEditStaff(){
resetStaffForm(true);
renderStaffList();
}

function deleteStaff(username){
const users = getUsers();
const targetUser = users.find((user)=> user.username === username);
if(!canManageUser(targetUser)){ return; }
setUsers(users.filter((user)=> user.username !== username));
setPointages(getPointages().filter((item)=> item.createdBy !== username));
document.getElementById("staffMsg").innerText = "Compte supprime.";
resetStaffForm(false);
renderStaffList();
}

function show(page){
document.querySelectorAll(".page").forEach((section)=>{ section.style.display = "none"; });
document.querySelectorAll(".nav-btn").forEach((button)=>{ button.classList.toggle("active", button.dataset.page === page); });
document.getElementById(page).style.display = "block";
if(page === "pointages"){ renderPointages(); }
if(page === "staff" && canManageStaff()){ renderStaffList(); }
}

function toggleDashboardGroup(group){
const target = document.getElementById("dashboard-group-" + group);
if(!target){
return;
}

const shouldOpen = target.classList.contains("hidden");
document.querySelectorAll(".dashboard-group-body").forEach((body)=>{
body.classList.add("hidden");
});
document.querySelectorAll(".staff-detail-panel").forEach((panel)=>{
panel.classList.add("hidden");
});
document.querySelectorAll(".hierarchy-person-card").forEach((card)=>{
card.classList.remove("active-person-card");
});

if(shouldOpen){
target.classList.remove("hidden");
}
}

function showStaffCard(person){
document.querySelectorAll(".staff-detail-panel").forEach((panel)=>{
panel.classList.add("hidden");
});
document.querySelectorAll(".hierarchy-person-card").forEach((card)=>{
card.classList.toggle("active-person-card", card.dataset.person === person);
});
const target = document.getElementById("staff-panel-" + person);
if(target){
target.classList.remove("hidden");
}
}

function toggleDocSection(section){
const target = document.getElementById("doc-section-" + section);
if(!target){
return;
}

const shouldOpen = target.classList.contains("hidden");
document.querySelectorAll(".doc-section-body").forEach((body)=>{
body.classList.add("hidden");
});

if(shouldOpen){
target.classList.remove("hidden");
}
}

function renderApp(){
const isBoss = currentUser.role === "boss";
const isManager = currentUser.role === "manager";
document.getElementById("loginScreen").classList.add("hidden");
document.getElementById("appShell").classList.remove("hidden");
document.getElementById("welcomeText").innerText = "Salut " + currentUser.displayName;
document.getElementById("dashboardText").innerText = isBoss ? "Consulte la hierarchie interne et ouvre chaque carte pour modifier les informations utiles." : isManager ? "Consulte les cartes du staff et gere les informations de chaque responsable." : "Consulte les cartes du staff et les informations importantes du club.";
document.getElementById("pointageHint").innerText = "Mode local actif. Cette version enregistre sur cet appareil.";
document.getElementById("pointagesNav").classList.remove("hidden");
document.getElementById("staffNav").classList.toggle("hidden", !canManageStaff());
document.getElementById("pointagesTitle").innerText = canManageAll() ? "Tous les pointages" : "Mes pointages";
document.getElementById("pointagesText").innerText = canManageAll() ? "Tu vois ici tous les pointages du club." : "Tu vois ici uniquement tes propres pointages.";
document.getElementById("staffPageText").innerText = canManageAll() ? "Tu peux creer, modifier ou supprimer n'importe quel compte hors patron." : "Tu peux creer et gerer uniquement les comptes lies a ton acces.";
document.getElementById("staffScopePanel").innerText = canManageAll() ? "Tu peux attribuer un role et un secteur a chaque compte." : "Tu peux gerer uniquement les comptes rattaches a ton acces.";
document.getElementById("ownerPasswordPanel").classList.toggle("hidden", currentUser.username !== "adrian");
const ownerEmailInput = document.getElementById("ownerNewEmail");
if(ownerEmailInput){
ownerEmailInput.value = currentUser.username === "adrian" ? getUserEmail(currentUser) : "";
}
if(!canManageAll()){ document.getElementById("newRole").value = "staff"; }
document.getElementById("newDepartment").value = canManageAll() ? "bar" : currentUser.department;
document.getElementById("newDepartment").disabled = !canManageAll();
document.getElementById("filterDepartment").disabled = !canManageAll();
document.getElementById("filterDepartmentWrap").classList.toggle("hidden", !canManageAll());
document.getElementById("filterDepartment").value = "";
document.querySelectorAll(".docs-editor").forEach((field)=>{
field.readOnly = !canManageAll();
});
document.querySelectorAll(".docs-save-btn").forEach((button)=>{
button.classList.toggle("hidden", !canManageAll());
});
document.querySelectorAll(".card-editor").forEach((editor)=>{
editor.classList.toggle("hidden", currentUser.username !== "adrian");
});
renderDashboardHierarchy();
updatePointageFormState();
renderPointages();
if(canManageStaff()){ renderStaffList(); }
resetStaffForm(false);
applyTheme(localStorage.getItem(storageKeys.theme) || "light");
show("dashboard");
document.querySelectorAll(".dashboard-group-body").forEach((group)=>{
group.classList.add("hidden");
});
document.querySelectorAll(".staff-detail-panel").forEach((panel)=>{
panel.classList.add("hidden");
});
document.querySelectorAll(".hierarchy-person-card").forEach((card)=>{
card.classList.remove("active-person-card");
});
}

function updateOwnPassword(){
if(!currentUser || currentUser.username !== "adrian"){
return;
}

const passwordInput = document.getElementById("ownerNewPassword");
const message = document.getElementById("ownerPasswordMsg");
const nextPassword = passwordInput.value.trim();

if(!nextPassword){
message.innerText = "Entre un nouveau mot de passe.";
return;
}

const users = getUsers();
const targetUser = users.find((user)=> user.username === currentUser.username);
if(!targetUser){
message.innerText = "Compte introuvable.";
return;
}

targetUser.password = nextPassword;
setUsers(users);
currentUser = targetUser;
localStorage.setItem(storageKeys.session, JSON.stringify(targetUser));
passwordInput.value = "";
message.innerText = "Mot de passe mis a jour.";
}

function updateOwnEmail(){
if(!currentUser || currentUser.username !== "adrian"){
return;
}

const emailInput = document.getElementById("ownerNewEmail");
const message = document.getElementById("ownerEmailMsg");
const nextEmail = emailInput.value.trim().toLowerCase();

if(!nextEmail){
message.innerText = "Entre une nouvelle adresse mail.";
return;
}

const users = getUsers();
const duplicateUser = users.find((user)=> user.username !== currentUser.username && getUserEmail(user).toLowerCase() === nextEmail);
if(duplicateUser){
message.innerText = "Cette adresse mail existe deja.";
return;
}

const targetUser = users.find((user)=> user.username === currentUser.username);
if(!targetUser){
message.innerText = "Compte introuvable.";
return;
}

targetUser.email = nextEmail;
setUsers(users);
currentUser = targetUser;
localStorage.setItem(storageKeys.session, JSON.stringify(targetUser));
message.innerText = "Adresse mail mise a jour.";
}

seedUsers();
seedPointages();
restoreSession();
loadSavedPhotos();
loadSavedCardDescriptions();
loadSavedSections();
restoreTheme();

Object.assign(window, {
login,
logout,
show,
savePointage,
deletePointage,
showPointagePerson,
changeTheme,
submitStaffForm,
cancelEditStaff,
editStaff,
deleteStaff,
openPhotoPicker,
handlePhotoUpload,
saveSectionContent,
saveCardDescription,
updateOwnEmail,
updateOwnPassword,
toggleDashboardGroup,
showStaffCard,
toggleDocSection
});
