#!/bin/bash

curl -sL https://rpm.nodesource.com/setup_12.x | bash -
yum install -y nodejs

if [[ "$EOS_VERSION" = "" || "$EOS_VERSION" = "latest" ]]; then
    echo "EOS_VERSION, using default: 'latest'"
    eos_url=$(curl -s https://api.github.com/repos/EOSIO/eos/releases/latest | grep "browser_download_url.*rpm" | cut -d '"' -f 4)
    eos_filename=$(/usr/bin/curl -s https://api.github.com/repos/EOSIO/eos/releases/latest | grep "name.*rpm" | cut -d '"' -f 4)
else
    eos_url=$(curl -s https://api.github.com/repos/EOSIO/eos/releases/tags/$EOS_VERSION | grep "browser_download_url.*rpm" | cut -d '"' -f 4)
    eos_filename=$(/usr/bin/curl -s https://api.github.com/repos/EOSIO/eos/releases/tags/$EOS_VERSION | grep "name.*rpm" | cut -d '"' -f 4)
fi

if [[ "$CDT_VERSION" = "" || "$CDT_VERSION" = "latest" ]]; then
    echo "CDT_VERSION, using default: 'latest'"
    cdt_url=$(/usr/bin/curl -s https://api.github.com/repos/EOSIO/eosio.cdt/releases/latest | grep "browser_download_url.*rpm" | cut -d '"' -f 4)
    cdt_filename=$(/usr/bin/curl -s https://api.github.com/repos/EOSIO/eosio.cdt/releases/latest | grep "name.*rpm" | cut -d '"' -f 4)
else
    cdt_url=$(/usr/bin/curl -s https://api.github.com/repos/EOSIO/eosio.cdt/releases/tags/$CDT_VERSION | grep "browser_download_url.*rpm" | cut -d '"' -f 4)
    cdt_filename=$(/usr/bin/curl -s https://api.github.com/repos/EOSIO/eosio.cdt/releases/tags/$CDT_VERSION | grep "name.*rpm" | cut -d '"' -f 4)
fi

wget $eos_url && yum install -y $eos_filename && rm -rf "$eos_filename"
wget $cdt_url && yum install -y $cdt_filename && rm -rf "$cdt_filename"
