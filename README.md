# Download and install nvm:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

# in lieu of restarting the shell
```bash
\. "$HOME/.nvm/nvm.sh"
```

# Download and install Node.js:
```bash
nvm install 22
```

# Verify the Node.js version:
Should print "v22.21.1"
```bash
node -v
```

# Download and install pnpm:
```bash
corepack enable pnpm
```

# Verify pnpm version:
```bash
pnpm -v
```

# Get bot
```bash
git clone https://github.com/sinascorpion/diamante.git
```
```bash
cd diamante
```

# Replace your referral code
Don't replace the link, for instance, if it is `https://campaign.diamante.io/?ref=RTY-QWER`, just replace `RTY-QWER`
```bash
nano code.txt
```

# Replace your wallet private key with 0x
```bash
nano .env
```

# Install dependencies
```bash
npm install axios ethers https-proxy-agent chalk dotenv ora
```
# Run the bot
```bash
npm start
```

Features Are:

Claim Faucet 
Send To Friend 
Send To Random


