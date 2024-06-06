const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("swap", function () {
    let Token;
    let token;
    let TokenExchange;
    let exchange;
    let owner;
    let addr1;
    let addr2;
  
    beforeEach(async function () {
      [owner, addr1, addr2] = await ethers.getSigners();
  
      // Deploy the Token contract
      Token = await ethers.getContractFactory("Token");
      token = await Token.deploy();
      await token.deployed();
  
      // Deploy the TokenExchange contract
      TokenExchange = await ethers.getContractFactory("TokenExchange");
      exchange = await TokenExchange.deploy();
      await exchange.deployed();
  
      // Mint tokens to the owner
      await token.mint(owner.address, ethers.utils.parseUnits("1000", 18));
    });
  
    describe("swapTokensForETH", function () {
      it("Should swap tokens for ETH", async function () {
        const initialTokenReserves = ethers.utils.parseUnits("1000", 18);
        const initialEthReserves = ethers.utils.parseEther("1");
  
        // Create the liquidity pool
        await exchange.createPool({ value: initialEthReserves });
  
        // Add liquidity
        const additionalEth = ethers.utils.parseEther("0.5");
        await exchange.addLiquidity(1, 100000, { value: additionalEth });
  
        // Swap tokens for ETH
        const amountTokens = ethers.utils.parseUnits("10", 18);
        const maxExchangeRate = 100000;
        await expect(exchange.swapTokensForETH(amountTokens, maxExchangeRate))
          .to.emit(token, "Transfer")
          .withArgs(owner.address, exchange.address, amountTokens);
      });
    });
});
  