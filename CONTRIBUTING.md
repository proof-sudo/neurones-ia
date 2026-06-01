# Guide de contribution — Neurones IA

Bienvenue dans l'équipe. Ce document explique comment travailler sur le projet
sans casser la production.

---

## Les 3 branches à connaître

```
main   ──────────────────────────────────►  Préprod / VPS
         ↑ PR validée seulement
dev    ──────────────────────────────────►  Intégration équipe
         ↑ PR depuis vos branches
feature/ma-feature  ─────────────────────►  Votre travail du moment
```

| Branche | Rôle | Qui peut pousser directement |
|---|---|---|
| `main` | Préprod — **tout merge ici déclenche un déploiement automatique** | Personne (PR obligatoire) |
| `dev` | Intégration de toutes les features avant mise en préprod | L'équipe (après review) |
| `feature/xxx` | Votre travail individuel | Vous |

---

## Démarrer une nouvelle feature

```bash
# 1. Se mettre à jour sur dev
git checkout dev
git pull origin dev

# 2. Créer votre branche
git checkout -b feature/nom-court-descriptif
# Exemples : feature/dashboard-kpi, feature/fix-chat-mobile, feature/sync-odoo
```

---

## Travailler et sauvegarder

```bash
# Committer régulièrement (pas tout à la fin)
git add .
git commit -m "feat: description claire de ce que ça fait"

# Pousser sur GitHub
git push -u origin feature/nom-court-descriptif
```

### Format des messages de commit

```
feat: ajout d'une nouvelle fonctionnalité
fix: correction d'un bug
chore: changement technique sans impact utilisateur (config, deps...)
docs: mise à jour de documentation
style: changement visuel / CSS uniquement
refactor: réécriture sans changer le comportement
```

---

## Soumettre votre travail (Pull Request)

1. Aller sur **github.com/proof-sudo/neurones-ia**
2. Cliquer sur **"Compare & pull request"** (apparaît automatiquement)
3. Cible : **`dev`** (jamais directement `main`)
4. Remplir la description : ce que vous avez fait, comment tester
5. Assigner un relecteur si besoin
6. Attendre la review avant de merger

---

## Mise en préprod (dev → main)

Quand `dev` est stable et testé :

1. Ouvrir une **PR `dev` → `main`** sur GitHub
2. Faire valider par le responsable technique
3. Merger → **le déploiement se déclenche automatiquement en moins de 2 minutes**
4. Vérifier sur [http://187.127.228.104:8080](http://187.127.228.104:8080) que tout fonctionne

---

## Ce qui se passe lors d'un déploiement automatique

Quand quelqu'un merge dans `main`, GitHub Actions fait automatiquement :

```
1. Se connecte au VPS en SSH
2. git pull origin main         ← récupère le nouveau code
3. docker compose up --build -d ← reconstruit et redémarre les containers
4. docker image prune -f        ← nettoie les anciennes images
```

Durée : environ **3 à 5 minutes** (build Docker inclus).
Pendant ce temps, le site reste accessible (l'ancien container sert jusqu'au redémarrage).

---

## Règles importantes

- **Ne jamais pousser directement sur `main`** — passez toujours par une PR
- **Ne jamais committer `.env.prod`** — ce fichier contient les secrets et est ignoré par git
- **Ne pas committer `data/`** — les données Odoo, GED et ChromaDB restent sur le VPS
- Tester localement avant d'ouvrir une PR
- Une PR = une fonctionnalité (éviter les PR géantes qui mélangent tout)

---

## Configurer git sur votre machine (première fois)

```bash
git config --global user.name  "Votre Nom"
git config --global user.email "vous@neuronestech.com"
```

Cloner le projet :

```bash
git clone https://github.com/proof-sudo/neurones-ia.git
cd neurones-ia
```

---

## En cas de conflit

```bash
# Mettre dev à jour dans votre branche
git checkout feature/ma-feature
git fetch origin
git rebase origin/dev

# Résoudre les conflits dans les fichiers marqués, puis :
git add .
git rebase --continue
git push --force-with-lease origin feature/ma-feature
```

---

## Contacts

| Rôle | Contact |
|---|---|
| Responsable technique | dtraore@neuronestech.com |
| Repo GitHub | github.com/proof-sudo/neurones-ia |
| Application (préprod) | http://187.127.228.104:8080 |
