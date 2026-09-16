#!/bin/sh
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
sdk_dir=${1:?Использование: sh build-sdk.sh /путь/к/OpenWrt-SDK}
[ -f "$sdk_dir/rules.mk" ] || { echo 'Некорректный OpenWrt SDK.' >&2; exit 1; }
for package in nimarkoflow luci-app-nimarkoflow; do
    [ ! -e "$sdk_dir/package/$package" ] || { echo "Каталог package/$package уже существует; используйте чистый SDK." >&2; exit 1; }
done
cd "$sdk_dir"
./scripts/feeds update -a
./scripts/feeds install -a
cp -R "$project_dir/nimarkoflow" "$sdk_dir/package/nimarkoflow"
cp -R "$project_dir/luci-app-nimarkoflow" "$sdk_dir/package/luci-app-nimarkoflow"
chmod 755 "$sdk_dir/package/nimarkoflow/files/usr/bin/nimarkoflow" "$sdk_dir/package/nimarkoflow/files/etc/init.d/nimarkoflow" "$sdk_dir/package/luci-app-nimarkoflow/root/usr/libexec/rpcd/nimarkoflow"
printf '\nCONFIG_PACKAGE_nimarkoflow=m\nCONFIG_PACKAGE_luci-app-nimarkoflow=m\n' >> .config
make defconfig
# These packages contain only scripts and LuCI assets. Runtime dependencies
# remain in APK/IPK metadata and are resolved by the router package manager.
make -j2 package/nimarkoflow/compile NO_DEPS=1 V=s
make -j2 package/luci-app-nimarkoflow/compile NO_DEPS=1 V=s
echo 'Пакеты собраны в bin/packages. Для APK используйте подпись своим ключом.'
