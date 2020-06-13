#/bin/bash

if [ ! -d $HOME/eosio-wallet ]; then
    mkdir -p $HOME/eosio-wallet;
fi
if [ ! -d /contracts ]; then
    mkdir -p /contracts;
fi
if [ ! -d $HOME/netbios ]; then
    mkdir -p $HOME/netbios;
fi


cd /
wget https://github.com/eosio/eosio.cdt/releases/download/v1.6.3/eosio.cdt_1.6.3-1-ubuntu-18.04_amd64.deb
sudo apt install ./eosio.cdt_1.6.3-1-ubuntu-18.04_amd64.deb -y
rm -rf ./eosio.cdt_1.6.3-1-ubuntu-18.04_amd64.deb
cd /
git clone https://github.com/EOSIO/eosio.contracts.git eosio.contracts-1.8.x
cd ./eosio.contracts-1.8.x
./build.sh -y

cp /eosio.contracts-1.8.x/build/contracts/. /contracts/eosio.old -a
rm -rf /eosio.contracts-1.8.x

## building new eosio system contracts

## upgrade to latest CDT
cd /
wget https://github.com/EOSIO/eosio.cdt/releases/download/v1.7.0/eosio.cdt_1.7.0-1-ubuntu-18.04_amd64.deb
sudo apt install -y ./eosio.cdt_1.7.0-1-ubuntu-18.04_amd64.deb
rm -rf ./eosio.cdt_1.7.0-1-ubuntu-18.04_amd64.deb

cd /
git clone https://github.com/EOSIO/eosio.contracts.git
cd ./eosio.contracts/
rm -rf build
./build.sh -y

cp /eosio.contracts/build/contracts/. /contracts/eosio.latest -a
rm -rf /eosio.contracts

## install eosio
cd /
wget https://github.com/eosio/eos/releases/download/v2.0.4/eosio_2.0.4-1-ubuntu-18.04_amd64.deb
sudo apt install -y ./eosio_2.0.4-1-ubuntu-18.04_amd64.deb
rm -rf ./eosio_2.0.4-1-ubuntu-18.04_amd64.deb