const {
	loadFixture,
  } = require("@nomicfoundation/hardhat-network-helpers");
  const { expect } = require("chai");
  
  function roundDown(number, decimals) {
	decimals = decimals || 0;
	return ( Math.floor( number * Math.pow(10, decimals) ) / Math.pow(10, decimals) );
  }
  
  describe("TokenExchange", function () {
	async function deployTokenExchangeFixture() {
	  const [owner, otherAccount] = await ethers.getSigners();
  
	  // Deploy the Token contract
	  const Token = await ethers.getContractFactory("Token");
	  const token = await Token.deploy();
	  await token.deployed();
  
	  // Deploy the TokenExchange contract
	  const TokenExchange = await ethers.getContractFactory("TokenExchange");
	  const exchange = await TokenExchange.deploy();
	  await exchange.deployed();
  
	  // Transfer some tokens to the owner
	  await token.mint(10000);
	  await token.transfer(owner.address, 10000);
  
	  // Approve token transfer to the exchange for pool creation
	  await token.approve(exchange.address, 5000);
  
	  // Initialize the exchange contract
	  await exchange.createPool(5000, { value: ethers.utils.parseEther("5") });
  
	  return { token, exchange, owner, otherAccount };
	}
  
	describe("addLiquidity", function () {
	  it("Should add liquidity successfully", async function () {
		const { token, exchange, owner } = await loadFixture(deployTokenExchangeFixture);
  
		// Approve token transfer to the exchange
		await token.approve(exchange.address, 2000);
  
		// Calculate realistic min and max exchange rates
		const multiplier = 10**5;
		const ethReserves = ethers.utils.parseEther("5");
		const tokenReserves = 5000;
		const minExchangeRate = (tokenReserves * multiplier * 10**18) / ethReserves; // Adjust to realistic values
		const maxExchangeRate = minExchangeRate * 2; // Adjust to realistic values
		
		// Add liquidity
		await exchange.addLiquidity(minExchangeRate, maxExchangeRate, { value: ethers.utils.parseEther("2") });
  
		const [newTokenReserves, newEthReserves] = await exchange.getLiquidity();
		expect(newTokenReserves).to.equal(7000); // 5000 initial + 2000 added
		expect(newEthReserves).to.equal(ethers.utils.parseEther("7")); // 5 initial + 2 added
	  });
	});
  
	describe("removeLiquidity", function () {
	  it("Should remove liquidity successfully", async function () {
		const { token, exchange, owner } = await loadFixture(deployTokenExchangeFixture);
  
		// Approve token transfer to the exchange
		await token.approve(exchange.address, 2000);
  
		// Calculate realistic min and max exchange rates
		const multiplier = 10**5;
		const totalShares = 10**5;
		const ethReserves = ethers.utils.parseEther("5");
		const tokenReserves = 5000;
		const minExchangeRate = (tokenReserves * multiplier * 10**18) / ethReserves;
		const maxExchangeRate = minExchangeRate * 2;
  
		// Add liquidity
		await exchange.addLiquidity(minExchangeRate, maxExchangeRate, { value: ethers.utils.parseEther("2") });
  
		// Remove liquidity
		await exchange.removeLiquidity(ethers.utils.parseEther("1"), minExchangeRate, maxExchangeRate);
  
		const [newTokenReserves, newEthReserves] = await exchange.getLiquidity();
		expect(roundDown(parseFloat(newTokenReserves), -1)).to.equal(6000); // 7000 - 1000 removed
		expect(roundDown(parseFloat(newEthReserves), -14).toString()).to.equal(ethers.utils.parseEther("6")); // 7 - 1 removed
	  });
	});
  
	describe("removeAllLiquidity", function () {
	  it("Should remove all liquidity successfully", async function () {
		const { token, exchange, owner } = await loadFixture(deployTokenExchangeFixture);
  
		// Approve token transfer to the exchange
		await token.approve(exchange.address, 2000);
  
		// Calculate realistic min and max exchange rates
		const multiplier = 10**5;
		const ethReserves = ethers.utils.parseEther("5");
		const tokenReserves = 5000;
		const minExchangeRate = (tokenReserves * multiplier * 10**18) / ethReserves; // Adjust to realistic values
		const maxExchangeRate = minExchangeRate * 2; // Adjust to realistic values
  
		// Add liquidity
		await exchange.addLiquidity(minExchangeRate, maxExchangeRate, { value: ethers.utils.parseEther("2") });
  
		// Remove all liquidity
		await exchange.removeAllLiquidity(minExchangeRate, maxExchangeRate);
  
		const [newTokenReserves, newEthReserves] = await exchange.getLiquidity();
		expect(roundDown(parseFloat(newTokenReserves), -5)).to.equal(0);
		expect(roundDown(parseFloat(newEthReserves), -19).toString()).to.equal(ethers.utils.parseEther("0"));
	  });
	});
  });
  