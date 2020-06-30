
require('dotenv').config();
const fs = require('fs');
const request = require('request');
const _ = require('underscore');
const {execSync, exec} = require('child_process');
const {Tail} = require('tail');

var args = process.argv.slice(2);

const {HOSTNAME, SERVER_PORT, P2P_PORT} = process.env;

//cleos system listproducers -l 100

function genesisConfigCheck(cb) {
    setInterval(function(){
        console.log(`Seeking config file: ${new Date().getTime()}`)
        let configFound = execSync(` [ -f /data/blockchain/config.json ] && echo "true" || echo "false"`).toString().indexOf('true') != -1;
        console.log(configFound);
        if(configFound) {
            clearInterval(this);
            cb();
        }
    }, 5000);
}

// getSystemContract();
if(args.includes('reset')) {
    reset();
    process.exit(0);
} else if(args.includes('stop')) {
    stopNode();
    process.exit(0);
}

function stopNode() {
    execSync('pkill nodeos || true');
    execSync(`pkill keosd || true`);
    execSync(`sleep 2`);
}

function purgeNode() {
    console.log('purging')
    execSync(`rm -rf /data/${HOSTNAME}`);
    
}

function reset() {
    stopNode();
    if(HOSTNAME == 'nodeos-0') execSync(`rm -rf /data/blockchain/config.json`);
    // execSync(`rm -rf /data/blockchain/config.json`);
    execSync(`rm -rf /data/blockchain/${HOSTNAME}`);
    execSync(`rm -rf /root/eosio-wallet/default.wallet`);
    execSync(`mkdir -p /data/blockchain/${HOSTNAME}`);
}

function runCmd(cmd) {
    if(cmd) {
        let pid = Number(execSync(cmd).toString());
    } else {
        console.log(`exec cmd: ${cmd} does not exist`);
    }
}

class Node {
    constructor(config) {
        let isLive = this.checkProcesses();
        if(isLive) {
            console.log(`${HOSTNAME} is already live!`);
            process.exit(0);
        } else if(config) {
            console.log('config found!');
            let {commands, wallet, keys} = config;

            execSync(`rm -rf /data/blockchain/${HOSTNAME} && mkdir -p /data/blockchain/${HOSTNAME}`);
            runCmd(commands.genesis);
            // this.monitorNode();
        } else if(HOSTNAME == 'nodeos-0'){
            let wallet = this.setupWallet();

            let config = {};
            this.nodeName = HOSTNAME;
            
            let serverUrl = `0.0.0.0:${SERVER_PORT}`; //`${HOSTNAME}:${SERVER_PORT}`; 
            let p2pPort = `0.0.0.0:${P2P_PORT}`; //`${HOSTNAME}:${P2P_PORT}`;
            
            let nodes = ['nodeos-0', 'nodeos-1', 'nodeos-2', 'nodeos-3'];
            
            _.each(nodes, (node) => {
                let keys = this.createKeys();
                let {privateKey, publicKey} = keys;
                let bcPath = `/data/blockchain/${node}`;
                let commands = this.createWorkflows({node, keys, serverUrl, p2pPort, bcPath, nodes});

                this.importKey(privateKey);
                config[node] = {keys: keys, commands: commands};
                if(node == 'nodeos-0') config[node].wallet = wallet;
            });

            fs.writeFileSync(`/data/blockchain/config.json`, JSON.stringify(config, 0, 4));
            this.createGenesisFile(config['nodeos-0'].keys.publicKey);
            runCmd(config['nodeos-0'].commands.genesis);

            let masterPublicKey = config['nodeos-0'].keys.publicKey;
            setTimeout(() => {
                this.createSystemAccounts(masterPublicKey);
                this.setupSystemContracts();
                this.createStakeAccounts({masterPublicKey, config});
                this.resignSystemAccounts();
                // this.voteProducers(['node.a', 'node.b', 'node.c']);
                // this.monitorNode();
            }, 1e4);
        }
    }

    voteProducers(prods) {
        let stdout = execSync(`cleos system voteproducer prods eosio ${prods.join(' ')}`).toString();
        console.log(stdout);
    }

    checkProcesses() {
        let psRef = {};
        let processFound = false;
        let stdout = execSync('ps ao pid,command').toString();
        let psList = stdout.split('\n')
    
        psList.forEach((ps) => {
            let pid = ps.match(/([0-9]+)/);
            let eosNode = ps.match(/(?<=--signature-provider ).*?(?==KEY)/g);
    
            pid = pid ? pid[0] : null;
            eosNode = eosNode ? eosNode[0] : null;
            if(pid && eosNode && !psRef[eosNode]) {
                psRef[eosNode] = {nodeName: HOSTNAME, pid:Number(pid)}
                processFound = true;
            }
        });
    
        return processFound ? psRef : false;
    }

    getNodes() {
        let nodes = fs.readdirSync('/data/blockchain', {withFileTypes: true}).filter(dirent => dirent.isDirectory()).map(dirent => dirent.name).sort((a, b) => b.localeCompare(a));
        let tms = new Date().getTime();
        let nodeLib = {};
        let index = 0;
        _.each(nodes, (node) => {
            let isActive = false;
            if(node != 'contracts' && node != 'config') {
                try {
                    console.log(node);
                    let {stderr} = execSync(`ping ${node} -c 1`);
                    isActive = !stderr;
                } catch(e) {
                    // console.log(e);
                }
        
                if(!isActive) {
                    execSync(`rm -rf /data/blockchain/${node}`);
                    console.log(`${node} is removed due to inactivity`);
                } else {
                    nodeLib[node] = {timestamp: tms, index:index};
                    if(index == 0) nodeLib[node].master = true;
                    // nodeLib[node].keys = this.createKeys();
                }
                index++;
            }
        });

        
        return nodeLib;
    }

    



    createGenesisFile(publicKey) {
        let filePath = `/data/blockchain/genesis.json`;
        var ts = new Date().toISOString().slice(0,-1);
        var genesis = {
            initial_timestamp:ts,
            initial_key: publicKey,
            initial_configuration: {
                max_block_net_usage: 1048576,
                target_block_net_usage_pct: 1000,
                max_transaction_net_usage: 524288,
                base_per_transaction_net_usage: 12,
                net_usage_leeway: 500,
                context_free_discount_net_usage_num: 20,
                context_free_discount_net_usage_den: 100,
                max_block_cpu_usage: 200000,
                target_block_cpu_usage: 1000,
                max_transaction_cpu_usage: 150000,
                min_transaction_cpu_usage: 100,
                max_transaction_lifetime: 3600,
                deferred_trx_expiration_window: 600,
                max_transaction_delay: 3888000,
                max_inline_action_size: 4096,
                max_inline_action_depth: 4,
                max_authority_depth: 6
            },
            initial_chain_id: "0000000000000000000000000000000000000000000000000000000000000000"
        };
        
        fs.writeFileSync(filePath, JSON.stringify(genesis,0,4));
        return filePath;
        
    }

    createSystemAccounts(publicKey) {
        let systemAccounts = ['eosio.bpay', 'eosio.msig', 'eosio.names', 'eosio.ram', 'eosio.ramfee', 'eosio.saving', 'eosio.stake', 'eosio.token', 'eosio.vpay', 'eosio.rex'];
        systemAccounts.forEach((accountName) => {
            this.createAccount(accountName, publicKey);
        });
    }

    createWorkflows(data) {
        let commands = {};
        let {node, nodes, keys, serverUrl, p2pPort, bcPath} = data;
        let seedPath = `--genesis-json /data/blockchain/genesis.json \\`;
        let producerName = node == 'nodeos-0' ? 'eosio' : node.replace(/-/, '.');
        let clientParams = [
            'nodeos \\',
            `--max-irreversible-block-age -1 \\`,
            `--max-transaction-time 2000 \\`,
            `--signature-provider ${keys.publicKey}=KEY:${keys.privateKey} \\`,
            `--plugin eosio::producer_plugin \\`,
            `--chain-state-db-size-mb 1024 \\`,
            `--plugin eosio::producer_api_plugin \\`,
            `--plugin eosio::chain_plugin \\`,
            `--plugin eosio::chain_api_plugin \\`,
            `--plugin eosio::http_plugin \\`,
            `--plugin eosio::history_api_plugin \\`,
            `--plugin eosio::history_plugin \\`,
            // `--plugin eosio::wallet_api_plugin \\`,
            `--data-dir "${bcPath}/data" \\`,
            `--blocks-dir "${bcPath}/blocks" \\`,
            `--config-dir "${bcPath}/config" \\`,
            `--producer-name "${producerName}" \\`,
            `--access-control-allow-origin=* \\`,
            `--contracts-console \\`,
            `--http-validate-host=false \\`,
            `--verbose-http-errors \\`,
            `--enable-stale-production \\`,
            `--http-server-address ${serverUrl} \\`,
            `--http-max-response-time-ms 1000 \\`,
            `--p2p-listen-endpoint ${p2pPort} \\`,
            `--plugin eosio::net_api_plugin \\`
        ];

        commands.stopCmd = `pkill nodeos && pkill keosd`;

        // let stopCmd = `
        // if [ -f "${nodeName}/eosd.pid" ]; then
        // pid='cat "${nodeName}/eosd.pid"'
        // echo $pid
        // kill $pid
        // rm -r "${nodeName}/eosd.pid"
        // echo -ne "Stoping Node"
        // while true; do
        // [ ! -d "/proc/$pid/fd" ] && break
        // echo -ne "."
        // sleep 1
        // done
        // echo -ne "\rNode Stopped. \n"
        // fi`

        _.each(nodes, (n) => {

            if(n != node) {
                n = n.replace(/[.]/,'-')
                clientParams.push(`--p2p-peer-address ${n}:${P2P_PORT} \\`)
            }
        });

        clientParams.push(`>> "${bcPath}/nodeos.log" 2>&1 & echo $!`);
        commands.start = clientParams.join('\n');
        
        clientParams.splice(-1, 0, '--hard-replay-blockchain \\');
        commands.startHard = clientParams.join('\n');
        
        clientParams.splice(-2, 1);
        clientParams.splice(-1, 0, seedPath);
        commands.genesis = clientParams.join('\n');
        return commands;
    }


    //startWallet
    //importKeys
    setupWallet(walletName='default') {
        let path = `/root/eosio-wallet/${walletName}.wallet`;
        let hasWallet = fs.existsSync(path);
        let walletPwd = this.wallet;
        if(!hasWallet || (hasWallet && !walletPwd)) {
            console.log('creating new wallet');
            reset();
            //keosd --http-server-address=$HOSTNAME:8787 </dev/null &>/dev/null &
            let stdOut = execSync(`
                pkill keosd
                cleos wallet create -n ${walletName} --to-console
                sleep 5
            `).toString();
            
            let pwd = stdOut.match(/"(.*?)"/)[1];
            return pwd;
        } else if(walletPwd) { // unlocking wallet
            console.log('unlocking wallet');
            execSync(`cleos wallet unlock --password ${walletPwd}`);
            return walletPwd;
        }
        
        return false;
    }
    
    createKeys() {
        let keys = execSync('cleos create key --to-console').toString().replace(/(Private key: |Public key: )/g,'').split('\n');
        let privateKey = keys[0];
        let publicKey = keys[1];
        return {privateKey, publicKey};
    }
    
    importKey(privateKey, gConfig) {
        let stdOut = gConfig ? execSync(`cleos --url ${gConfig.serverUrl} wallet unlock --password: ${gConfig.wallet} && cleos --url ${gConfig.serverUrl} wallet import --private-key ${privateKey}`).toString() : execSync(`cleos wallet import --private-key ${privateKey}`).toString();
        console.log(stdOut);
    }

    createAccount(accountName, publicKey) {

        let cmd = `cleos --url http://0.0.0.0:${SERVER_PORT} create account eosio ${accountName} ${publicKey} ${publicKey}`
        console.log(cmd)
        let stdout = execSync(cmd).toString();
        console.log(stdout);
    }

    setupSystemContracts() {
        console.log('1. install eosio.token & eosio.msig contract');

        // let stdout = execSync(`
        // contract_dir=${PWD}/eosio.contracts
        // rm -rf ${contract_dir}
        // echo $contract
        // git clone --branch add-boot-contract https://github.com/EOSIO/eosio.contracts.git
        // cd eosio.contracts
        // rm -fr build
        // mkdir build
        // cd build
        // cmake ..
        // make -j$( nproc )
        // cp -a contracts /data/contracts
        // rm -rf ${contract_dir}`);
        execSync(`
        mkdir -p /data/blockchain && mkdir -p /data/blockchain/contracts
        wget https://github.com/helixious/eos_sys_contracts/raw/master/contracts.tar.gz -O /data/blockchain/contracts/sys_contract.tar.gz
        tar -xzf /data/blockchain/contracts/sys_contract.tar.gz -C /data/blockchain/contracts/
        rm -rf /data/blockchain/contracts/sys_contract.tar.gz
        `);

        let stdout = execSync(`
        cleos --url http://0.0.0.0:${SERVER_PORT} set contract eosio.token /data/blockchain/contracts/eosio_1.8/eosio.token/
        cleos --url http://0.0.0.0:${SERVER_PORT} set contract eosio.msig /data/blockchain/contracts/eosio_1.8/eosio.msig/
        sleep 2
        `);

        // let stdout = execSync(`
        // cleos --url http://${HOSTNAME}:${SERVER_PORT} set contract eosio.token /data/eosio_latest/eosio.token/
        // cleos --url http://${HOSTNAME}:${SERVER_PORT} set contract eosio.msig /data/eosio_latest/eosio.msig/
        // sleep 2
        // `);

        console.log('1.2 create system tokens');
        stdout = execSync(`cleos --url http://0.0.0.0:${SERVER_PORT} push action eosio.token create '[ "eosio", "10000000000.0000 SYS" ]' -p eosio.token@active`).toString();
        console.log(stdout);

        console.log('1.3 issue system tokens');
        stdout = execSync(`cleos --url http://0.0.0.0:${SERVER_PORT} push action eosio.token issue '[ "eosio", "1000000000.0000 SYS", "memo" ]' -p eosio@active`).toString();
        console.log(stdout);

        
        console.log('1.4 preactivate feature');
        stdout = execSync(`
        curl --request POST \
        --url http://0.0.0.0:${SERVER_PORT}/v1/producer/schedule_protocol_feature_activations \
        -d '{"protocol_features_to_activate": ["0ec7e080177b2c02b278d5088611686b49d739925a92d9bfcacd7fc6b74053bd"]}'
        `).toString();
        console.log(stdout);

        // console.log('1.5 install system OLD contract');
        console.log('1.5 install system new contract');
        stdout = execSync(`
        sleep 2
        cleos --url http://0.0.0.0:${SERVER_PORT} set contract eosio /data/blockchain/contracts/eosio_1.8/eosio.system/ -p eosio@owner
        `).toString();
        // stdout = execSync(`
        // sleep 2
        // cleos --url http://${HOSTNAME}:${SERVER_PORT} set contract eosio /data/eosio_l.8x/eosio.system/ -p eosio@owner
        // `).toString();
        // console.log(stdout);

        console.log(`1.6 enable features`);
        stdout = execSync(`
        sleep 2
        # GET_SENDER
        cleos --url http://0.0.0.0:${SERVER_PORT} push action eosio activate '["f0af56d2c5a48d60a4a5b5c903edfb7db3a736a94ed589d0b797df33ff9d3e1d"]' -p eosio

        # FORWARD_SETCODE
        cleos --url http://0.0.0.0:${SERVER_PORT} push action eosio activate '["2652f5f96006294109b3dd0bbde63693f55324af452b799ee137a81a905eed25"]' -p eosio

        # ONLY_BILL_FIRST_AUTHORIZER
        cleos --url http://0.0.0.0:${SERVER_PORT} push action eosio activate '["8ba52fe7a3956c5cd3a656a3174b931d3bb2abb45578befc59f283ecd816a405"]' -p eosio

        # RESTRICT_ACTION_TO_SELF
        cleos --url http://0.0.0.0:${SERVER_PORT} push action eosio activate '["ad9e3d8f650687709fd68f4b90b41f7d825a365b02c23a636cef88ac2ac00c43"]' -p eosio

        # DISALLOW_EMPTY_PRODUCER_SCHEDULE
        cleos --url http://0.0.0.0:${SERVER_PORT} push action eosio activate '["68dcaa34c0517d19666e6b33add67351d8c5f69e999ca1e37931bc410a297428"]' -p eosio

        # FIX_LINKAUTH_RESTRICTION
        cleos --url http://0.0.0.0:${SERVER_PORT} push action eosio activate '["e0fb64b1085cc5538970158d05a009c24e276fb94e1a0bf6a528b48fbc4ff526"]' -p eosio

        # REPLACE_DEFERRED
        cleos --url http://0.0.0.0:${SERVER_PORT} push action eosio activate '["ef43112c6543b88db2283a2e077278c315ae2c84719a8b25f25cc88565fbea99"]' -p eosio

        # NO_DUPLICATE_DEFERRED_ID
        cleos --url http://0.0.0.0:${SERVER_PORT} push action eosio activate '["4a90c00d55454dc5b059055ca213579c6ea856967712a56017487886a4d4cc0f"]' -p eosio

        # ONLY_LINK_TO_EXISTING_PERMISSION
        cleos --url http://0.0.0.0:${SERVER_PORT} push action eosio activate '["1a99a59d87e06e09ec5b028a9cbb7749b4a5ad8819004365d02dc4379a8b7241"]' -p eosio

        # RAM_RESTRICTIONS
        cleos --url http://0.0.0.0:${SERVER_PORT} push action eosio activate '["4e7bf348da00a945489b2a681749eb56f5de00b900014e137ddae39f48f69d67"]' -p eosio

        # WEBAUTHN_KEY
        cleos --url http://0.0.0.0:${SERVER_PORT} push action eosio activate '["4fca8bd82bbd181e714e283f83e1b45d95ca5af40fb89ad3977b653c448f78c2"]' -p eosio

        # WTMSIG_BLOCK_SIGNATURES
        cleos --url http://0.0.0.0:${SERVER_PORT} push action eosio activate '["299dcb6af692324b899b39f16d5a530a33062804e41f09dc97e9f156b4476707"]' -p eosio
        `).toString();
        console.log(stdout);


        console.log('1.7 install system LATEST contract');
        stdout = execSync(`
        sleep 2
        cleos --url http://0.0.0.0:${SERVER_PORT} set contract eosio /data/blockchain/contracts/eosio_latest/eosio.system/ -p eosio
        sleep 2
        `).toString();
        console.log(stdout);

        console.log('1.8 set eosio.msig as privileged account');
        stdout = execSync(`
        cleos --url http://0.0.0.0:${SERVER_PORT} push action eosio setpriv '["eosio.msig", 1]' -p eosio@active
        sleep 2`).toString();
        console.log(stdout);

        console.log(`1.9 init system account`);
        stdout = execSync(`
        cleos --url http://0.0.0.0:${SERVER_PORT} push action eosio init '["0", "4,SYS"]' -p eosio@active
        sleep 3`).toString();
        console.log(stdout);
    }

    createStakeAccounts({config}) {
        _.each(config, (data, node) => {
            let publicKey = data.keys.publicKey
            let stdout = execSync(`cleos --url http://0.0.0.0:${SERVER_PORT} system newaccount eosio --transfer ${node}  ${publicKey} --stake-net "100000000.0000 SYS" --stake-cpu "100000000.0000 SYS" --buy-ram-kbytes 8192`).toString();
            console.log(stdout);
            this.registerProducer(node, publicKey);
        });
    }

    registerProducer(node, publicKey) {
        let stdout = execSync(`cleos --url http://0.0.0.0:${SERVER_PORT} system regproducer ${node} ${publicKey} http://${node}:${SERVER_PORT} `).toString();
        console.log(stdout);
    }

    resignSystemAccounts() {
        let stdout = execSync(`cleos --url http://0.0.0.0:${SERVER_PORT} push action eosio updateauth '{"account": "eosio", "permission": "owner", "parent": "", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio.prods", "permission": "active"}}]}}' -p eosio@owner
        cleos --url http://${HOSTNAME}:${SERVER_PORT} push action eosio updateauth '{"account": "eosio", "permission": "active", "parent": "owner", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio.prods", "permission": "active"}}]}}' -p eosio@active`).toString();
        console.log(stdout);
 
        stdout = execSync(`cleos --url http://${HOSTNAME}:${SERVER_PORT} push action eosio updateauth '{"account": "eosio.bpay", "permission": "owner", "parent": "", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio", "permission": "active"}}]}}' -p eosio.bpay@owner
        cleos --url http://${HOSTNAME}:${SERVER_PORT} push action eosio updateauth '{"account": "eosio.bpay", "permission": "active", "parent": "owner", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio", "permission": "active"}}]}}' -p eosio.bpay@active
        
        cleos --url http://${HOSTNAME}:${SERVER_PORT} push action eosio updateauth '{"account": "eosio.msig", "permission": "owner", "parent": "", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio", "permission": "active"}}]}}' -p eosio.msig@owner
        cleos --url http://${HOSTNAME}:${SERVER_PORT} push action eosio updateauth '{"account": "eosio.msig", "permission": "active", "parent": "owner", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio", "permission": "active"}}]}}' -p eosio.msig@active
        
        cleos --url http://${HOSTNAME}:${SERVER_PORT} push action eosio updateauth '{"account": "eosio.names", "permission": "owner", "parent": "", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio", "permission": "active"}}]}}' -p eosio.names@owner
        cleos --url http://${HOSTNAME}:${SERVER_PORT} push action eosio updateauth '{"account": "eosio.names", "permission": "active", "parent": "owner", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio", "permission": "active"}}]}}' -p eosio.names@active
        
        cleos --url http://${HOSTNAME}:${SERVER_PORT} push action eosio updateauth '{"account": "eosio.ram", "permission": "owner", "parent": "", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio", "permission": "active"}}]}}' -p eosio.ram@owner
        cleos --url http://${HOSTNAME}:${SERVER_PORT} push action eosio updateauth '{"account": "eosio.ram", "permission": "active", "parent": "owner", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio", "permission": "active"}}]}}' -p eosio.ram@active
        
        cleos --url http://${HOSTNAME}:${SERVER_PORT} push action eosio updateauth '{"account": "eosio.ramfee", "permission": "owner", "parent": "", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio", "permission": "active"}}]}}' -p eosio.ramfee@owner
        cleos --url http://${HOSTNAME}:${SERVER_PORT} push action eosio updateauth '{"account": "eosio.ramfee", "permission": "active", "parent": "owner", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio", "permission": "active"}}]}}' -p eosio.ramfee@active
        
        cleos --url http://${HOSTNAME}:${SERVER_PORT} push action eosio updateauth '{"account": "eosio.saving", "permission": "owner", "parent": "", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio", "permission": "active"}}]}}' -p eosio.saving@owner
        cleos --url http://${HOSTNAME}:${SERVER_PORT} push action eosio updateauth '{"account": "eosio.saving", "permission": "active", "parent": "owner", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio", "permission": "active"}}]}}' -p eosio.saving@active
        
        cleos --url http://${HOSTNAME}:${SERVER_PORT} push action eosio updateauth '{"account": "eosio.stake", "permission": "owner", "parent": "", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio", "permission": "active"}}]}}' -p eosio.stake@owner
        cleos --url http://${HOSTNAME}:${SERVER_PORT} push action eosio updateauth '{"account": "eosio.stake", "permission": "active", "parent": "owner", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio", "permission": "active"}}]}}' -p eosio.stake@active
        
        cleos --url http://${HOSTNAME}:${SERVER_PORT} push action eosio updateauth '{"account": "eosio.token", "permission": "owner", "parent": "", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio", "permission": "active"}}]}}' -p eosio.token@owner
        cleos --url http://${HOSTNAME}:${SERVER_PORT} push action eosio updateauth '{"account": "eosio.token", "permission": "active", "parent": "owner", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio", "permission": "active"}}]}}' -p eosio.token@active
 
        cleos --url http://${HOSTNAME}:${SERVER_PORT} push action eosio updateauth '{"account": "eosio.vpay", "permission": "owner", "parent": "", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio", "permission": "active"}}]}}' -p eosio.vpay@owner
        cleos --url http://${HOSTNAME}:${SERVER_PORT} push action eosio updateauth '{"account": "eosio.vpay", "permission": "active", "parent": "owner", "auth": {"threshold": 1, "keys": [], "waits": [], "accounts": [{"weight": 1, "permission": {"actor": "eosio", "permission": "active"}}]}}' -p eosio.vpay@active`).toString();
        console.log(stdout);
    }

    exec(type) {
        let cmd = this.commands[type];
        if(cmd) {
            this.pid = Number(execSync(cmd).toString());
        } else {
            console.log(`exec cmd: ${type} does not exist`);
        }
    }

    monitorNode() {
        const tail = new Tail(`/data/blockchain/${HOSTNAME}/nodeos.log`, {fromBeginning: false});
        const {startHard} = this.commands;
        var restartCount = 0;
        tail.on("line", function(data) {
            if(data.indexOf('replay required') != -1) {
                console.log('replay required');
                if(restartCount > 5) {
                    console.log('exceeded (5) forced reboots');
                    process.exit(1);
                }

                runCmd(startHard);
                restartCount++;
            }

            console.log(data);
        });
    }
}

if(HOSTNAME != 'nodeos-0') {
    genesisConfigCheck(() => {
        let config = JSON.parse(fs.readFileSync('/data/blockchain/config.json', 'utf8'))[HOSTNAME];
        const node = new Node(config);
    });
} else {
    const node = new Node();
}