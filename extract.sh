#!/bin/bash
SCRIPTPATH="$( cd "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
mkdir -p $SCRIPTPATH/blockchain && mkdir -p $SCRIPTPATH/blockchain/contracts
wget https://github.com/helixious/eos_sys_contracts/raw/master/contracts.tar.gz -O $SCRIPTPATH/blockchain/contracts/sys_contract.tar.gz
tar -xzf $SCRIPTPATH/blockchain/contracts/sys_contract.tar.gz -C $SCRIPTPATH/blockchain/contracts/
rm -rf $SCRIPTPATH/blockchain/contracts/sys_contract.tar.gz