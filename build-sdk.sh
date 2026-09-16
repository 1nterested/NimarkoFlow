#!/bin/sh
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
sdk_dir=${1:?Использование: sh build-sdk.sh /путь/к/OpenWrt-SDK}
[ -f "$sdk_dir/rules.mk" ] || { echo 'Некорректный OpenWrt SDK.' >&2; exit 1; }
for package in nimarkoflow luci-app-nimarkoflow; do
    [ ! -e "$sdk_dir/package/$package" ] || { echo "Каталог package/$package уже существует; используйте чистый SDK." >&2; exit 1; }
done
cp -R "$project_dir/nimarkoflow" "$sdk_dir/package/nimarkoflow"
cp -R "$project_dir/luci-app-nimarkoflow" "$sdk_dir/package/luci-app-nimarkoflow"
chmod 755 "$sdk_dir/package/nimarkoflow/files/usr/bin/nimarkoflow" "$sdk_dir/package/nimarkoflow/files/etc/init.d/nimarkoflow" "$sdk_dir/package/luci-app-nimarkoflow/root/usr/libexec/rpcd/nimarkoflow"
cd "$sdk_dir"
./scripts/feeds update -a
./scripts/feeds install -a
printf '\nCONFIG_PACKAGE_nimarkoflow=m\nCONFIG_PACKAGE_luci-app-nimarkoflow=m\n' >> .config
make defconfig
make package/nimarkoflow/compile V=s
make package/luci-app-nimarkoflow/compile V=s
echo 'Пакеты собраны в bin/packages. Для APK используйте подпись своим ключом.'
