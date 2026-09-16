include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-nimarkoflow

PKG_VERSION:=0.1.0
PKG_RELEASE:=1
PKG_LICENSE:=GPL-2.0-or-later
PKG_MAINTAINER:=nimarko

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-nimarkoflow
	SECTION:=luci
	CATEGORY:=LuCI
	TITLE:=NimarkoFlow
	DEPENDS:=+luci-base +rpcd +nimarkoflow
	PKGARCH:=all
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/luci-app-nimarkoflow/install
	$(INSTALL_DIR) $(1)/www
	$(CP) ./htdocs/. $(1)/www/
	$(CP) ./root/. $(1)/
	chmod 755 $(1)/usr/libexec/rpcd/nimarkoflow
endef

define Package/luci-app-nimarkoflow/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
rm -f /tmp/luci-indexcache.*
/etc/init.d/rpcd reload
endef

$(eval $(call BuildPackage,luci-app-nimarkoflow))
