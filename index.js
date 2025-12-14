import axios from 'axios';
import { ethers } from 'ethers';
import fs from 'fs/promises';
import readline from 'readline';
import { HttpsProxyAgent } from 'https-proxy-agent';
import dotenv from 'dotenv';

dotenv.config();

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
};

const logger = {
  info: (msg) => console.log(`${colors.bold}${colors.white}[INFO] ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.bold}${colors.yellow}[WARN] ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.bold}${colors.red}[ERROR] ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.bold}${colors.green}[SUCCESS] ${msg}${colors.reset}`),
  loading: (msg) => console.log(`${colors.bold}${colors.cyan}[LOADING] ${msg}${colors.reset}`),
  banner: () => {
    console.log(`${colors.bold}${colors.cyan}`);
    console.log(`============================================`);
    console.log(`       DIAMANTE AUTO BOT`);
    console.log(`     CREATED BY sinascorpion======>Telegram Channel: @irdropper`);
    console.log(`============================================`);
  },
};

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
];

const API_BASE = "https://campapi.diamante.io/api/v1";
const REFF_FILE = "reff.json";
const CODE_FILE = "code.txt";

async function loadReffWallets() {
  try {
    const data = await fs.readFile(REFF_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

async function saveReffWallets(wallets) {
  try {
    await fs.writeFile(REFF_FILE, JSON.stringify(wallets, null, 2));
    logger.success(`Wallets saved to ${REFF_FILE}`);
  } catch (error) {
    logger.error(`Failed to save wallets: ${error.message}`);
  }
}

async function loadReferralCode() {
  try {
    const data = await fs.readFile(CODE_FILE, 'utf-8');
    return data.trim();
  } catch (error) {
    return null;
  }
}

class ProxyManager {
  constructor() {
    this.proxies = [];
    this.currentIndex = 0;
  }

  async loadProxies() {
    try {
      const data = await fs.readFile('proxies.txt', 'utf-8');
      this.proxies = data.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(proxy => this.parseProxy(proxy));
      
      logger.info(`Loaded ${this.proxies.length} proxies`);
      return this.proxies.length > 0;
    } catch (error) {
      logger.warn('No proxies.txt found. Running without proxy.');
      return false;
    }
  }

  parseProxy(proxyString) {
    try {
      if (proxyString.startsWith('http://') || proxyString.startsWith('https://') || proxyString.startsWith('socks://')) {
        return proxyString;
      }

      const parts = proxyString.split(':');
      
      if (parts.length === 2) {
        return `http://${parts[0]}:${parts[1]}`;
      } else if (parts.length === 4) {
        return `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`;
      } else if (proxyString.includes('@')) {
        return `http://${proxyString}`;
      }
      
      return `http://${proxyString}`;
    } catch (error) {
      logger.error(`Failed to parse proxy: ${proxyString}`);
      return null;
    }
  }

  getNextProxy() {
    if (this.proxies.length === 0) return null;
    
    const proxy = this.proxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
    return proxy;
  }
}

class DiamanteBotClient {
  constructor(privateKey, proxy = null) {
    try {
      const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      this.wallet = new ethers.Wallet(formattedKey);
      this.address = this.wallet.address;
      this.privateKey = this.wallet.privateKey;
    } catch (error) {
      throw new Error(`Invalid private key: ${error.message}`);
    }
    
    this.userId = null;
    this.accessToken = null;
    this.testnetAddress = null;
    this.proxy = proxy;
    this.userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    this.axiosInstance = null;
  }

  createAxiosInstance() {
    const config = {
      baseURL: API_BASE,
      timeout: 30000,
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'ja,en-US;q=0.9,en;q=0.8',
        'access-token': 'key',
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        'origin': 'https://campaign.diamante.io',
        'referer': 'https://campaign.diamante.io/',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
      }
    };

    if (this.proxy) {
      config.httpsAgent = new HttpsProxyAgent(this.proxy);
      config.httpAgent = new HttpsProxyAgent(this.proxy);
    }

    this.axiosInstance = axios.create(config);
    
    this.axiosInstance.interceptors.request.use((reqConfig) => {
      if (this.accessToken) {
        reqConfig.headers['cookie'] = `access_token=${this.accessToken}`;
      }
      return reqConfig;
    });

    return this.axiosInstance;
  }

  getAxiosConfig() {
    const config = {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'ja,en-US;q=0.9,en;q=0.8',
        'access-token': 'key',
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        'origin': 'https://campaign.diamante.io',
        'referer': 'https://campaign.diamante.io/',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
      },
      timeout: 30000
    };

    if (this.accessToken) {
      config.headers['cookie'] = `access_token=${this.accessToken}`;
    }

    if (this.proxy) {
      config.httpsAgent = new HttpsProxyAgent(this.proxy);
      config.httpAgent = new HttpsProxyAgent(this.proxy);
    }

    return config;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async retryRequest(requestFn, maxRetries = 5, initialDelay = 3000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        const status = error.response?.status;
        
        if (attempt === maxRetries) {
          throw error;
        }

        if (status === 429) {
          const delay = initialDelay * attempt;
          logger.warn(`Rate limit hit, waiting ${delay/1000}s (attempt ${attempt}/${maxRetries})`);
          await this.sleep(delay);
        } else if (status >= 500) {
          const delay = initialDelay * Math.pow(2, attempt - 1);
          logger.warn(`Server error ${status}, retrying in ${delay/1000}s...`);
          await this.sleep(delay);
        } else if (status === 401 || status === 403) {
          logger.error(`Auth error: ${status}`);
          throw error;
        } else {
          throw error;
        }
      }
    }
  }

  generateRandomLocation(index = 1) {
    const locations = [
      { name: "Tokyo", lat: [35.6, 35.8], lon: [139.6, 139.8], country: "Japan", code: "JP", continent: "Asia", region: "Kanto" },
      { name: "Yokohama", lat: [35.4, 35.5], lon: [139.5, 139.7], country: "Japan", code: "JP", continent: "Asia", region: "Kanto" },
      { name: "Osaka", lat: [34.6, 34.7], lon: [135.4, 135.6], country: "Japan", code: "JP", continent: "Asia", region: "Kinki" },
      { name: "Nagoya", lat: [35.1, 35.2], lon: [136.8, 137.0], country: "Japan", code: "JP", continent: "Asia", region: "Chubu" },
      { name: "Sapporo", lat: [43.0, 43.1], lon: [141.3, 141.4], country: "Japan", code: "JP", continent: "Asia", region: "Hokkaido" },
      { name: "Fukuoka", lat: [33.5, 33.6], lon: [130.3, 130.5], country: "Japan", code: "JP", continent: "Asia", region: "Kyushu" },
      { name: "Singapore", lat: [1.2, 1.4], lon: [103.7, 103.9], country: "Singapore", code: "SG", continent: "Asia", region: "Central" },
      { name: "Seoul", lat: [37.5, 37.6], lon: [126.9, 127.1], country: "South Korea", code: "KR", continent: "Asia", region: "Seoul" },
      { name: "Hong Kong", lat: [22.2, 22.4], lon: [114.1, 114.3], country: "Hong Kong", code: "HK", continent: "Asia", region: "HK" },
    ];

    const location = locations[index % locations.length];
    
    const jitterLat = (Math.random() - 0.5) * 0.02;
    const jitterLon = (Math.random() - 0.5) * 0.02;
    
    const latitude = (Math.random() * (location.lat[1] - location.lat[0]) + location.lat[0] + jitterLat).toFixed(7);
    const longitude = (Math.random() * (location.lon[1] - location.lon[0]) + location.lon[0] + jitterLon).toFixed(7);
    
    return { 
      latitude: parseFloat(latitude), 
      longitude: parseFloat(longitude),
      city: location.name,
      country: location.country,
      countryCode: location.code,
      continent: location.continent,
      continentCode: "AS",
      region: location.region
    };
  }

  generateDeviceId(index = 1) {
    return `DEVDA${1000 + index}`;
  }

  async connectWallet(index = 1) {
    try {
      logger.loading(`Connecting wallet ${this.address.slice(0, 6)}...${this.address.slice(-4)}`);
      
      const deviceId = this.generateDeviceId(index);
      const location = this.generateRandomLocation(index);
      
      logger.info(`Location: ${location.city}, ${location.country}`);
      
      const ipLast = 40 + (index % 150);
      const ipAddress = `103.153.246.${ipLast}`;
      
      const payload = {
        address: this.address,
        deviceId,
        deviceSource: "web_app",
        deviceType: "Windows",
        browser: "Edge",
        ipAddress: ipAddress,
        latitude: location.latitude,
        longitude: location.longitude,
        countryCode: location.countryCode,
        country: location.country,
        continent: location.continent,
        continentCode: location.continentCode,
        region: location.region,
        regionCode: "Unknown",
        city: location.city
      };

      const response = await this.retryRequest(async () => {
        return await axios.post(
          `${API_BASE}/user/connect-wallet`,
          payload,
          this.getAxiosConfig()
        );
      });

      if (response.data.success) {
        this.userId = response.data.data.userId;
        this.testnetAddress = response.data.data.testnetWalletAddress;
        
        const cookies = response.headers['set-cookie'];
        if (cookies) {
          for (const cookie of cookies) {
            if (cookie.startsWith('access_token=')) {
              this.accessToken = cookie.split(';')[0].split('=')[1];
              break;
            }
          }
        }

        logger.success(`Connected! User ID: ${this.userId.slice(0, 8)}...`);
        return response.data.data;
      }
      
      logger.error('Connect wallet failed: No success response');
      return null;
    } catch (error) {
      logger.error(`Connect wallet failed: ${error.response?.data?.message || error.message}`);
      return null;
    }
  }

  async register(socialHandle, referralCode) {
    try {
      logger.loading(`Registering with handle: ${socialHandle}`);
      
      const payload = {
        userId: this.userId,
        walletAddress: this.address,
        socialHandle,
        referralCode: referralCode
      };

      const response = await this.retryRequest(async () => {
        return await axios.post(
          `${API_BASE}/auth/register`,
          payload,
          this.getAxiosConfig()
        );
      });

      if (response.data.success) {
        this.testnetAddress = response.data.data.testnetWallet;
        logger.success(`Registered! Testnet: ${this.testnetAddress}`);
        return response.data.data;
      }

      logger.error('Registration failed: No success response');
      return null;
    } catch (error) {
      logger.error(`Registration failed: ${error.response?.data?.message || error.message}`);
      return null;
    }
  }

  async getUserStatus() {
    try {
      const response = await this.retryRequest(async () => {
        return await axios.get(
          `${API_BASE}/auth/get-user-status/${this.userId}`,
          this.getAxiosConfig()
        );
      });

      if (response.data.success) {
        const status = response.data.data;
        logger.info(`Status: TX Count ${status.transactionCount || 0}, Badge Count ${status.badgeCount || 0}`);
        return status;
      }
      return null;
    } catch (error) {
      logger.error(`Get status failed: ${error.response?.data?.message || error.message}`);
      return null;
    }
  }

  async getXPStats() {
    try {
      const response = await this.retryRequest(async () => {
        return await axios.get(
          `${API_BASE}/xp/stats/${this.userId}`,
          this.getAxiosConfig()
        );
      });

      if (response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async getBalance() {
    try {
      logger.loading('Fetching balance...');
      
      const response = await this.retryRequest(async () => {
        return await axios.get(
          `${API_BASE}/transaction/get-balance/${this.userId}`,
          this.getAxiosConfig()
        );
      });

      if (response.data.success) {
        const balance = response.data.data.balance;
        logger.info(`Current balance: ${balance} DIAM`);
        return balance;
      }
      
      logger.warn('Balance fetch failed');
      return 0;
    } catch (error) {
      logger.error(`Get balance failed: ${error.response?.data?.message || error.message}`);
      return 0;
    }
  }

  async claimFaucet() {
    try {
      logger.loading('Claiming testnet tokens from faucet...');
      
      await this.sleep(1000);
      
      const response = await this.retryRequest(async () => {
        return await axios.get(
          `${API_BASE}/transaction/fund-wallet/${this.userId}`,
          this.getAxiosConfig()
        );
      });

      if (response.data.success) {
        const data = response.data.data || {};
        const fundedAmount = data.fundedAmount || 0;
        const finalBalance = data.finalBalance || 0;
        const nextEligibleAt = data.nextEligibleAt || null;
        
        logger.success(`Claimed ${fundedAmount} tokens! Balance: ${finalBalance}`);
        
        if (nextEligibleAt) {
          const nextTime = new Date(nextEligibleAt).toLocaleString();
          logger.info(`Next claim available at: ${nextTime}`);
        }
        
        return { success: true, balance: finalBalance, fundedAmount };
      } else {
        const message = response.data.message || 'Unknown error';
        logger.warn(`Faucet: ${message}`);
        return { success: false, message };
      }
    } catch (error) {
      const errorData = error.response?.data;
      const message = errorData?.message || error.message;
      
      if (message.includes('already claimed') || message.includes('wait') || message.includes('eligible')) {
        logger.warn(`Faucet: ${message}`);
      } else if (error.response?.status === 429) {
        logger.warn('Faucet: Rate limited, try again later');
      } else {
        logger.error(`Faucet claim failed: ${message}`);
      }
      
      return { success: false, message };
    }
  }

  async claimMysteryBox() {
    try {
      logger.loading('Claiming mystery box...');
      
      const response = await this.retryRequest(async () => {
        return await axios.get(
          `${API_BASE}/mystery/claim/${this.userId}`,
          this.getAxiosConfig()
        );
      });

      if (response.data.success) {
        const rewardData = response.data.data || {};
        const description = rewardData.description || 'Unknown';
        const reward = rewardData.mysteryReward || 0;
        const rewardType = rewardData.rewardType || 'Unknown';
        
        logger.success(`Mystery Box Claimed!`);
        logger.info(`Description: ${description}`);
        logger.info(`Reward: ${reward} (${rewardType})`);
        
        return { success: true, data: rewardData };
      } else {
        const message = response.data.message || 'Unknown error';
        logger.warn(`Mystery box: ${message}`);
        return { success: false, message };
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message;
      logger.warn(`Mystery box: ${message}`);
      return { success: false, message };
    }
  }

  async getLeaderboard() {
    try {
      const response = await this.retryRequest(async () => {
        return await axios.get(
          `${API_BASE}/leaderboard/user/${this.userId}?limit=20&page=1`,
          this.getAxiosConfig()
        );
      });

      if (response.data.success) {
        const container = response.data.data || {};
        const rows = container.data || [];
        
        let userEntry = null;
        for (const item of rows) {
          if (item.userId === this.userId) {
            userEntry = item;
            break;
          }
        }
        
        if (userEntry) {
          logger.info(`Leaderboard - Rank: ${userEntry.rank}, XP: ${userEntry.totalXP}, TX: ${userEntry.transactionCount}`);
          if (userEntry.badges && userEntry.badges.length > 0) {
            logger.info(`Badges: ${userEntry.badges.join(', ')}`);
          }
        }
        
        return userEntry;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async sendTransaction(toAddress, amount) {
    try {
      logger.loading(`Sending ${amount} DIAM to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`);
      
      const payload = {
        toAddress,
        amount: parseFloat(amount),
        userId: this.userId
      };

      const response = await this.retryRequest(async () => {
        return await axios.post(
          `${API_BASE}/transaction/transfer`,
          payload,
          this.getAxiosConfig()
        );
      });

      if (response.data.success) {
        const transferData = response.data.data || {};
        const hash = transferData.transferData?.hash || 'Unknown';
        logger.success(`Transaction sent! Hash: ${hash}`);
        
        const mysteryBoxInfo = transferData.mysteryBoxInfo;
        if (mysteryBoxInfo) {
          const current = mysteryBoxInfo.current || 0;
          const min = mysteryBoxInfo.min || 0;
          const eligible = mysteryBoxInfo.eligible || false;
          
          logger.info(`Mystery Box Progress: ${current}/${min} - Eligible: ${eligible}`);
          
          if (eligible === true) {
            await this.sleep(1000);
            await this.claimMysteryBox();
          }
        }
        
        return { success: true, hash, mysteryBoxInfo };
      }

      logger.error('Transaction failed: No success response');
      return { success: false };
    } catch (error) {
      logger.error(`Transaction failed: ${error.response?.data?.message || error.message}`);
      return { success: false };
    }
  }

  displayUserInfo(status, xpStats, balance) {
    console.log(`\n${colors.bold}${colors.cyan}${'='.repeat(60)}`);
    console.log(`                    WALLET INFORMATION`);
    console.log(`${'='.repeat(60)}${colors.reset}\n`);
    
    console.log(`${colors.bold}${colors.white}Address:${colors.reset}         ${this.address}`);
    console.log(`${colors.bold}${colors.white}User ID:${colors.reset}         ${this.userId}`);
    console.log(`${colors.bold}${colors.white}Testnet Address:${colors.reset} ${this.testnetAddress}`);
    console.log(`${colors.bold}${colors.white}Balance:${colors.reset}         ${balance} DIAM`);
    console.log(`${colors.bold}${colors.white}Transactions:${colors.reset}    ${status?.transactionCount || 0}`);
    console.log(`${colors.bold}${colors.white}Badges:${colors.reset}          ${status?.badgeCount || 0}`);
    
    if (xpStats) {
      console.log(`\n${colors.bold}${colors.yellow}XP STATS:${colors.reset}`);
      console.log(`${colors.bold}${colors.white}Total XP:${colors.reset}         ${xpStats.totalXP || 0}`);
      console.log(`${colors.bold}${colors.white}Multiplier:${colors.reset}       ${xpStats.currentMultiplier || 1}x`);
    }
    
    console.log(`\n${colors.bold}${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
  }

  toJSON() {
    return {
      address: this.address,
      privateKey: this.privateKey,
      userId: this.userId,
      testnetAddress: this.testnetAddress,
      accessToken: this.accessToken
    };
  }
}

async function question(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function generateRandomWallet() {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey
  };
}

function loadPrivateKeysFromEnv() {
  const privateKeys = [];
  let index = 1;
  
  while (true) {
    const key = process.env[`PRIVATE_KEY_${index}`];
    if (!key) break;
    privateKeys.push(key.trim());
    index++;
  }
  
  return privateKeys;
}

function generateRandomUsername() {
  const adjectives = ['crypto', 'moon', 'diamond', 'rocket', 'stellar', 'cosmic', 'quantum', 'alpha', 'omega', 'turbo'];
  const nouns = ['trader', 'holder', 'investor', 'hunter', 'pioneer', 'warrior', 'master', 'legend', 'king', 'boss'];
  const randomNum = Math.floor(Math.random() * 9999);
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${adj}${noun}${randomNum}`;
}

async function showMainMenu() {
  console.log(`\n${colors.bold}${colors.cyan}${'='.repeat(40)}`);
  console.log(`              MAIN MENU`);
  console.log(`${'='.repeat(40)}${colors.reset}`);
  console.log(`${colors.bold}${colors.white}1.${colors.reset} Claim Faucet`);
  console.log(`${colors.bold}${colors.white}2.${colors.reset} Send DIAM`);
  console.log(`${colors.bold}${colors.white}3.${colors.reset} Auto Reff`);
  console.log(`${colors.bold}${colors.white}4.${colors.reset} Claim Mystery Badge`);
  console.log(`${colors.bold}${colors.white}5.${colors.reset} Exit`);
  console.log(`${colors.bold}${colors.cyan}${'='.repeat(40)}${colors.reset}\n`);
  
  const choice = await question(`${colors.bold}${colors.white}Select option (1-5): ${colors.reset}`);
  return choice.trim();
}

async function selectWalletType() {
  console.log(`\n${colors.bold}${colors.white}Select wallet type:`);
  console.log(`1. Main Wallet (from .env)`);
  console.log(`2. Reff Wallet (from reff.json)${colors.reset}`);
  
  const choice = await question(`${colors.bold}${colors.white}Choice (1/2): ${colors.reset}`);
  return choice.trim();
}

async function claimFaucetMenu(proxyManager) {
  console.log(`\n${colors.bold}${colors.cyan}${'='.repeat(40)}`);
  console.log(`           CLAIM FAUCET`);
  console.log(`${'='.repeat(40)}${colors.reset}\n`);

  const walletType = await selectWalletType();

  let privateKeys = [];
  let walletLabel = '';

  if (walletType === '1') {
    privateKeys = loadPrivateKeysFromEnv();
    walletLabel = 'MAIN WALLET';
    if (privateKeys.length === 0) {
      logger.error('No private keys found in .env file');
      return;
    }
    logger.info(`Found ${privateKeys.length} main wallet(s)`);
  } else if (walletType === '2') {
    const reffWallets = await loadReffWallets();
    walletLabel = 'REFF WALLET';
    if (reffWallets.length === 0) {
      logger.error('No wallets found in reff.json');
      return;
    }
    privateKeys = reffWallets.map(w => w.privateKey);
    logger.info(`Found ${privateKeys.length} reff wallet(s)`);
  } else {
    logger.error('Invalid choice');
    return;
  }

  console.log(`\n${colors.bold}${colors.magenta}[${walletLabel}] Starting faucet claims...${colors.reset}\n`);

  let totalClaimed = 0;
  let totalFailed = 0;

  for (let i = 0; i < privateKeys.length; i++) {
    try {
      logger.info(`${'='.repeat(50)}`);
      logger.info(`[${walletLabel}] Processing Wallet ${i + 1}/${privateKeys.length}`);
      
      const proxy = proxyManager.getNextProxy();
      const client = new DiamanteBotClient(privateKeys[i], proxy);
      
      const connectResult = await client.connectWallet(i + 1);
      if (!connectResult) {
        logger.error('Failed to connect, skipping...');
        totalFailed++;
        continue;
      }

      await client.sleep(2000);
      
      await client.getUserStatus();
      
      await client.sleep(1000);
      
      const faucetResult = await client.claimFaucet();
      
      if (faucetResult.success) {
        totalClaimed++;
      } else {
        totalFailed++;
      }
      
      await client.sleep(1000);
      
      await client.getBalance();
      
      await client.sleep(3000);
    } catch (error) {
      logger.error(`Error: ${error.message}`);
      totalFailed++;
    }
  }

  logger.info(`${'='.repeat(50)}`);
  logger.success(`Faucet claim completed!`);
  logger.info(`Total Claimed: ${totalClaimed}, Total Failed/Skipped: ${totalFailed}`);
}

async function sendDiamMenu(proxyManager) {
  console.log(`\n${colors.bold}${colors.cyan}${'='.repeat(40)}`);
  console.log(`            SEND DIAM`);
  console.log(`${'='.repeat(40)}${colors.reset}\n`);

  const walletType = await selectWalletType();

  let privateKeys = [];
  let walletLabel = '';

  if (walletType === '1') {
    privateKeys = loadPrivateKeysFromEnv();
    walletLabel = 'MAIN WALLET';
    if (privateKeys.length === 0) {
      logger.error('No private keys found in .env file');
      return;
    }
    logger.info(`Found ${privateKeys.length} main wallet(s)`);
  } else if (walletType === '2') {
    const reffWallets = await loadReffWallets();
    walletLabel = 'REFF WALLET';
    if (reffWallets.length === 0) {
      logger.error('No wallets found in reff.json');
      return;
    }
    privateKeys = reffWallets.map(w => w.privateKey);
    logger.info(`Found ${privateKeys.length} reff wallet(s)`);
  } else {
    logger.error('Invalid choice');
    return;
  }

  console.log(`\n${colors.bold}${colors.white}Send to:`);
  console.log(`1. Specific Address`);
  console.log(`2. Random Generated Address${colors.reset}`);
  
  const sendType = await question(`${colors.bold}${colors.white}Choice (1/2): ${colors.reset}`);
  
  let targetAddress = null;
  
  if (sendType === '1') {
    targetAddress = await question(`${colors.bold}${colors.white}Enter target address: ${colors.reset}`);
    if (!ethers.isAddress(targetAddress)) {
      logger.error('Invalid address');
      return;
    }
  }

  const amount = await question(`${colors.bold}${colors.white}Enter amount of DIAM to send: ${colors.reset}`);
  const sendAmount = parseFloat(amount);
  
  if (isNaN(sendAmount) || sendAmount <= 0) {
    logger.error('Invalid amount');
    return;
  }

  const txCount = await question(`${colors.bold}${colors.white}Enter number of transactions per wallet: ${colors.reset}`);
  const transactionCount = parseInt(txCount);
  
  if (isNaN(transactionCount) || transactionCount < 1) {
    logger.error('Invalid transaction count');
    return;
  }

  console.log(`\n${colors.bold}${colors.magenta}[${walletLabel}] Starting transactions...${colors.reset}\n`);

  let totalSuccess = 0;
  let totalFailed = 0;

  for (let i = 0; i < privateKeys.length; i++) {
    try {
      logger.info(`${'='.repeat(50)}`);
      logger.info(`[${walletLabel}] Processing Wallet ${i + 1}/${privateKeys.length}`);
      
      const proxy = proxyManager.getNextProxy();
      const client = new DiamanteBotClient(privateKeys[i], proxy);
      
      const connectResult = await client.connectWallet(i + 1);
      if (!connectResult) {
        logger.error('Failed to connect, skipping...');
        continue;
      }

      await client.sleep(2000);
      
      await client.getBalance();

      for (let tx = 0; tx < transactionCount; tx++) {
        let destination = targetAddress;
        
        if (sendType === '2') {
          const randomWallet = await generateRandomWallet();
          destination = randomWallet.address;
          logger.info(`Generated random address: ${destination}`);
        }
        
        logger.info(`Transaction ${tx + 1}/${transactionCount}`);
        const result = await client.sendTransaction(destination, sendAmount);
        
        if (result.success) {
          logger.success(`Transaction ${tx + 1} successful!`);
          totalSuccess++;
        } else {
          logger.error(`Transaction ${tx + 1} failed`);
          totalFailed++;
        }

        if (tx < transactionCount - 1) {
          logger.loading('Waiting 15 seconds before next transaction...');
          await client.sleep(15000);
        }
        
        if ((tx + 1) % 5 === 0) {
          await client.getLeaderboard();
        }
      }

      await client.getBalance();
      
      await client.sleep(2000);
    } catch (error) {
      logger.error(`Error: ${error.message}`);
    }
  }

  logger.info(`${'='.repeat(50)}`);
  logger.success(`All transactions completed!`);
  logger.info(`Total Success: ${totalSuccess}, Total Failed: ${totalFailed}`);
}

async function autoReffMenu(proxyManager) {
  console.log(`\n${colors.bold}${colors.cyan}${'='.repeat(40)}`);
  console.log(`            AUTO REFF`);
  console.log(`${'='.repeat(40)}${colors.reset}\n`);

  let referralCode = await loadReferralCode();
  
  if (!referralCode) {
    logger.warn('No referral code found in code.txt');
    referralCode = await question(`${colors.bold}${colors.white}Enter Referral Code: ${colors.reset}`);
    if (!referralCode.trim()) {
      logger.error('Referral code is required');
      return;
    }
    await fs.writeFile(CODE_FILE, referralCode.trim());
    logger.success(`Referral code saved to ${CODE_FILE}`);
  } else {
    logger.info(`Using referral code from code.txt: ${referralCode}`);
  }

  const numWallets = parseInt(await question(`${colors.bold}${colors.white}Enter number of wallets to create: ${colors.reset}`));
  
  if (isNaN(numWallets) || numWallets < 1) {
    logger.error('Invalid number of wallets');
    return;
  }

  const existingWallets = await loadReffWallets();
  const newWallets = [];

  logger.info(`Creating ${numWallets} wallet(s)...`);

  for (let i = 0; i < numWallets; i++) {
    try {
      logger.info(`${'='.repeat(50)}`);
      logger.info(`Processing Wallet ${i + 1}/${numWallets}`);
      logger.info(`${'='.repeat(50)}`);

      logger.loading('Generating new wallet...');
      const walletData = await generateRandomWallet();
      
      if (!walletData || !walletData.privateKey) {
        logger.error('Failed to generate wallet, skipping...');
        continue;
      }

      logger.success(`Wallet generated: ${walletData.address}`);

      const proxy = proxyManager.getNextProxy();
      
      if (proxy) {
        logger.info(`Using proxy: ${proxy.replace(/\/\/.*:.*@/, '//****:****@')}`);
      }

      const client = new DiamanteBotClient(walletData.privateKey, proxy);

      const connectResult = await client.connectWallet(existingWallets.length + i + 1);
      if (!connectResult) {
        logger.error('Failed to connect wallet, skipping...');
        continue;
      }

      await client.sleep(2000);

      if (connectResult.isSocialExists === 'INITIAL') {
        const username = generateRandomUsername();
        const registerResult = await client.register(username, referralCode);
        
        if (!registerResult) {
          logger.error('Failed to register, skipping...');
          continue;
        }

        await client.sleep(2000);
      }

      await client.getUserStatus();
      await client.sleep(1000);
      
      await client.claimFaucet();
      await client.sleep(1000);
      
      await client.getBalance();

      const walletInfo = {
        address: client.address,
        privateKey: client.privateKey,
        userId: client.userId,
        testnetAddress: client.testnetAddress,
        createdAt: new Date().toISOString()
      };

      newWallets.push(walletInfo);
      
      const allWallets = [...existingWallets, ...newWallets];
      await saveReffWallets(allWallets);

      logger.success(`Wallet ${i + 1} completed successfully!`);

      if (i < numWallets - 1) {
        const delay = Math.floor(Math.random() * 3000) + 2000;
        logger.loading(`Waiting ${delay/1000}s before next wallet...`);
        await client.sleep(delay);
      }

    } catch (error) {
      logger.error(`Error processing wallet ${i + 1}: ${error.message}`);
      continue;
    }
  }

  logger.info(`${'='.repeat(50)}`);
  logger.success(`Process completed! Total wallets created: ${newWallets.length}`);
  logger.success(`All wallets saved to ${REFF_FILE}`);
  logger.info(`${'='.repeat(50)}\n`);
}

async function claimMysteryBadgeMenu(proxyManager) {
  console.log(`\n${colors.bold}${colors.cyan}${'='.repeat(40)}`);
  console.log(`        CLAIM MYSTERY BADGE`);
  console.log(`${'='.repeat(40)}${colors.reset}\n`);

  const walletType = await selectWalletType();

  let privateKeys = [];
  let walletLabel = '';

  if (walletType === '1') {
    privateKeys = loadPrivateKeysFromEnv();
    walletLabel = 'MAIN WALLET';
    if (privateKeys.length === 0) {
      logger.error('No private keys found in .env file');
      return;
    }
    logger.info(`Found ${privateKeys.length} main wallet(s)`);
  } else if (walletType === '2') {
    const reffWallets = await loadReffWallets();
    walletLabel = 'REFF WALLET';
    if (reffWallets.length === 0) {
      logger.error('No wallets found in reff.json');
      return;
    }
    privateKeys = reffWallets.map(w => w.privateKey);
    logger.info(`Found ${privateKeys.length} reff wallet(s)`);
  } else {
    logger.error('Invalid choice');
    return;
  }

  console.log(`\n${colors.bold}${colors.magenta}[${walletLabel}] Starting mystery badge claims...${colors.reset}\n`);

  let totalClaimed = 0;
  let totalFailed = 0;

  for (let i = 0; i < privateKeys.length; i++) {
    try {
      logger.info(`${'='.repeat(50)}`);
      logger.info(`[${walletLabel}] Processing Wallet ${i + 1}/${privateKeys.length}`);
      
      const proxy = proxyManager.getNextProxy();
      const client = new DiamanteBotClient(privateKeys[i], proxy);
      
      const connectResult = await client.connectWallet(i + 1);
      if (!connectResult) {
        logger.error('Failed to connect, skipping...');
        totalFailed++;
        continue;
      }

      await client.sleep(2000);
      
      await client.getUserStatus();
      await client.getBalance();
      
      await client.sleep(1000);
      
      const claimResult = await client.claimMysteryBox();
      
      if (claimResult.success) {
        totalClaimed++;
      } else {
        totalFailed++;
      }
      
      await client.getLeaderboard();
      
      await client.sleep(2000);
    } catch (error) {
      logger.error(`Error: ${error.message}`);
      totalFailed++;
    }
  }

  logger.info(`${'='.repeat(50)}`);
  logger.success(`Mystery badge claim completed!`);
  logger.info(`Total Claimed: ${totalClaimed}, Total Failed: ${totalFailed}`);
}

async function main() {
  console.clear();
  logger.banner();
  
  const proxyManager = new ProxyManager();
  await proxyManager.loadProxies();

  while (true) {
    const choice = await showMainMenu();

    switch (choice) {
      case '1':
        await claimFaucetMenu(proxyManager);
        break;

      case '2':
        await sendDiamMenu(proxyManager);
        break;

      case '3':
        await autoReffMenu(proxyManager);
        break;

      case '4':
        await claimMysteryBadgeMenu(proxyManager);
        break;

      case '5':
        console.log(`\n${colors.bold}${colors.cyan}============================================`);
        console.log(`       Goodbye! Thanks for using`);
        console.log(`============================================`);
        console.log(`${colors.bold}${colors.magenta}       Created by sinascorpion`);
        console.log(`       github.com/sinascorpion${colors.reset}`);
        console.log(`${colors.bold}${colors.cyan}============================================${colors.reset}\n`);
        process.exit(0);
        break;

      default:
        logger.warn('Invalid choice. Please select 1-5.');
        break;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
});

process.on('unhandledRejection', (error) => {
  logger.error(`Unhandled Rejection: ${error.message}`);
});

main().catch(error => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
