#!/bin/bash

contract_dir=/data/eosio.contracts
rm -rf ${contract_dir}
cd /data
git clone --branch add-boot-contract https://github.com/EOSIO/eosio.contracts.git
cd eosio.contracts
rm -fr build
mkdir build
cd build
cmake ..
make -j$( nproc )
cp -a contracts /data/eosio_latest
rm -rf ${contract_dir}
cd /data
git clone --branch release/1.8.x https://github.com/EOSIO/eosio.contracts.git
cd eosio.contracts
rm -fr build
mkdir build
cd build
cmake ..
make -j$( nproc )
cp -a contracts /data/eosio_1.8x
rm -rf ${contract_dir}