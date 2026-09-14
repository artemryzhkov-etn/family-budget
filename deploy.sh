#!/usr/bin/env bash
# Деплой на GitHub Pages.
#
# Перед першим запуском:
#   1. Створіть порожній репозиторій на GitHub (напр. budget-app).
#   2. У корені проєкту: git init && git remote add origin git@github.com:USER/budget-app.git
#      (або https://github.com/USER/budget-app.git)
#   3. Запустіть: ./deploy.sh
#
# Після деплою увімкніть Pages: Settings -> Pages -> Branch: gh-pages / root
# Апка буде на https://USER.github.io/budget-app/
set -euo pipefail
cd "$(dirname "$0")"

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "❌ Не налаштовано git remote 'origin'."
  echo "   git init && git remote add origin https://github.com/USER/REPO.git"
  exit 1
fi

echo "🔨 Збірка..."
npm run build

echo "🚀 Публікація гілки gh-pages..."
npx gh-pages -d dist --dotfiles

echo "✅ Готово. Перевірте Settings → Pages вашого репозиторію (гілка gh-pages)."
