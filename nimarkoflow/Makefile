include $(TOPDIR)/rules.mk

PKG_NAME:=nimarkoflow

NIMARKOFLOW_SOURCE_VERSION:=$(or $(NIMARKOFLOW_PACKAGE_VERSION),$(NIMARKOFLOW_VERSION))
NIMARKOFLOW_HAS_RELEASE_VERSION:=$(if $(filter dev,$(NIMARKOFLOW_SOURCE_VERSION)),,$(NIMARKOFLOW_SOURCE_VERSION))
NIMARKOFLOW_COMPILED_VERSION:=$(if $(NIMARKOFLOW_HAS_RELEASE_VERSION),$(NIMARKOFLOW_SOURCE_VERSION),$(or $(NIMARKOFLOW_SOURCE_VERSION),0.1.0))
NIMARKOFLOW_RELEASE_VERSION_VALID:=$(if $(NIMARKOFLOW_HAS_RELEASE_VERSION),$(shell printf '%s\n' '$(NIMARKOFLOW_SOURCE_VERSION)' | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$$' && printf '1'),1)

ifeq ($(NIMARKOFLOW_RELEASE_VERSION_VALID),)
$(error NIMARKOFLOW_PACKAGE_VERSION and NIMARKOFLOW_VERSION must use x.y.z format)
endif

PKG_VERSION:=$(or $(NIMARKOFLOW_HAS_RELEASE_VERSION),0.1.0)
PKG_RELEASE:=1

PKG_MAINTAINER:=nimarko
PKG_LICENSE:=GPL-2.0-or-later

include $(INCLUDE_DIR)/package.mk

define Package/nimarkoflow
	SECTION:=net
	CATEGORY:=Network
	DEPENDS:=+ca-bundle +kmod-inet-diag +kmod-netlink-diag +kmod-tun +curl +ucode +ucode-mod-fs +ucode-mod-uci +kmod-nft-tproxy +coreutils-base64 +bind-dig +nftables +kmod-nft-nat +ip-full
	CONFLICTS:=https-dns-proxy nextdns luci-app-passwall luci-app-passwall2
	TITLE:=NimarkoFlow backend service
	PKGARCH:=all
endef

define Package/nimarkoflow/description
	Rule-based NimarkoFlow backend with hybrid sing-box + zapret orchestration
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/nimarkoflow/prerm
#!/usr/bin/ucode

if (getenv("IPKG_INSTROOT") == null || getenv("IPKG_INSTROOT") == "")
	system("/usr/bin/nimarkoflow package_prerm " + (ARGV[0] || "") + " >/dev/null 2>&1");

exit(0);
endef

define Package/nimarkoflow/postinst
#!/bin/sh

[ -n "$${IPKG_INSTROOT}" ] && exit 0
NIMARKOFLOW_LIB=/usr/lib/nimarkoflow ucode -L /usr/lib/nimarkoflow /usr/lib/nimarkoflow/config/migration.uc migrate || exit $$?
chmod 600 /etc/config/nimarkoflow
/usr/bin/nimarkoflow package_postinst
endef

define Package/nimarkoflow/conffiles
/etc/config/nimarkoflow
endef

define Package/nimarkoflow/install
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/nimarkoflow $(1)/etc/init.d/nimarkoflow

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/nimarkoflow $(1)/etc/config/nimarkoflow

	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/usr/bin/nimarkoflow $(1)/usr/bin/nimarkoflow

	$(INSTALL_DIR) $(1)/usr/lib/nimarkoflow
	$(CP) ./files/usr/lib/. $(1)/usr/lib/nimarkoflow/

	sed -i -e 's/__COMPILED_VERSION_VARIABLE__/$(NIMARKOFLOW_COMPILED_VERSION)/g' $(1)/usr/lib/nimarkoflow/core/constants.uc
endef

$(eval $(call BuildPackage,nimarkoflow))
