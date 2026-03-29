# Galaxy Discord Bot

Bot Discord pour les rappels de presence du staff.

## Ce qu'il fait

- enregistre `/presence-rappel` pour envoyer un MP manuel a un membre
- enregistre `/presence-rappel-attente` pour relancer tous les comptes encore en attente
- lance un rappel automatique tous les jours a `19h` heure de Paris
- lit les reponses du site dans `presenceEntries`
- ne contacte que les comptes encore en attente
- utilise le `discordId` renseigne dans `Gestion staff`

## Installation

1. Ouvre un terminal dans ce dossier.
2. Lance `npm install`
3. Copie `.env.example` en `.env` si besoin.
4. Renseigne les variables Discord.
5. Ajoute l'acces Firebase Admin :
   - soit via `FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json`
   - soit via `FIREBASE_SERVICE_ACCOUNT_JSON`
6. Lance `npm start`

## Firebase Admin

Pour le rappel automatique, le bot doit pouvoir lire Firestore sans navigateur.

Le plus simple :
1. Firebase Console
2. `Project settings`
3. `Service accounts`
4. `Generate new private key`
5. place le fichier en `discord-bot/service-account.json`

Le bot lira alors :
- `staffProfiles`
- `presenceEntries`

## Rappel automatique

- heure : `19:00`
- fuseau : `Europe/Paris`
- cible : comptes actifs avec `discordId`
- condition : aucune reponse de presence ou statut `pending`

L'etat du dernier rappel est garde dans `bot-state.json` pour eviter les doublons.
