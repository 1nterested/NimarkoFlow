#!/bin/sh
set -eu
umask 077

# Install locally built packages; do not download code from another project.
if [ "$(id -u)" != 0 ]; then echo 'Запустите установщик от root на OpenWrt.' >&2; exit 1; fi
if [ ! -r /etc/openwrt_release ]; then echo 'Требуется OpenWrt.' >&2; exit 1; fi
if [ "$#" != 2 ]; then echo 'Использование: sh install.sh /tmp/nimarkoflow_*.ipk /tmp/luci-app-nimarkoflow_*.ipk (или .apk)' >&2; exit 2; fi
for package in "$@"; do
    [ -f "$package" ] || { echo 'Пакет не найден.' >&2; exit 1; }
done
case "$(basename "$1")" in nimarkoflow_*.ipk|nimarkoflow-*.apk) ;; *) echo 'Первым укажите пакет nimarkoflow.' >&2; exit 2;; esac
case "$(basename "$2")" in luci-app-nimarkoflow_*.ipk|luci-app-nimarkoflow-*.apk) ;; *) echo 'Вторым укажите пакет интерфейса.' >&2; exit 2;; esac
# A second routing service must not overwrite an active deployment.
for old_service in forkop podkop; do
    if [ -x "/etc/init.d/$old_service" ]; then
        echo "Обнаружен $old_service. Сначала сделайте резервную копию и удалите предыдущую установку штатным способом." >&2
        exit 1
    fi
done
if [ -f /etc/config/nimarkoflow ]; then
    backup="/root/nimarkoflow-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -m 700 "$backup"
    cp /etc/config/nimarkoflow "$backup/config"
    chmod 600 "$backup/config"
fi
if command -v opkg >/dev/null 2>&1; then
    case "$1:$2" in *.ipk:*.ipk) ;; *) echo 'Этой версии OpenWrt нужны IPK-пакеты.' >&2; exit 1;; esac
    opkg update
    if ! command -v sing-box >/dev/null 2>&1; then opkg install sing-box; fi
    opkg install "$1" "$2"
elif command -v apk >/dev/null 2>&1; then
    case "$1:$2" in *.apk:*.apk) ;; *) echo 'Этой версии OpenWrt нужны APK-пакеты.' >&2; exit 1;; esac
    apk update
    if ! command -v sing-box >/dev/null 2>&1; then apk add sing-box; fi
    # Packages must be signed by a key trusted by this device.
    apk add "$1" "$2"
else echo 'Менеджер пакетов OpenWrt не найден.' >&2; exit 1; fi
chmod 600 /etc/config/nimarkoflow
chmod 755 /usr/libexec/rpcd/nimarkoflow
/etc/init.d/nimarkoflow enable
/etc/init.d/rpcd restart
echo 'NimarkoFlow установлен. Откройте NimarkoFlow в главном меню OpenWrt и добавьте подписку.'
echo 'Для ограничения доступа выдайте пользователю только роль nimarkoflow-user; root остаётся администратором.'
