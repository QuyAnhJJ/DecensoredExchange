
const { expect } = require("chai");
const { ethers } = require("hardhat");
describe("TokenExchange", function () {
    let Token;
    let token;
    let TokenExchange;
    let exchange;
    let owner;
    let addr1;
    let addr2;

    beforeEach(async function () {
        [owner, addr1, addr2,] = await ethers.getSigners();

        // Deploy the Token contract
        Token = await ethers.getContractFactory("Token");
        token = await Token.deploy();
        await token.deployed();

        // Deploy the TokenExchange contract
        TokenExchange = await ethers.getContractFactory("TokenExchange");
        exchange = await TokenExchange.deploy();
        await exchange.deployed();

        

        

        
    });

    describe("createPool", function () {
        it("Should create a liquidity pool", async function () {
            const token_reserves = ethers.utils.parseUnits("1000", 18);
            const eth_reserves = ethers.utils.parseUnits("1", "ether");

            // Mint tokens to the owner
            await token.mint(token_reserves);
            const tokenSupply = await token.balanceOf(owner.address);
            console.log("Owner token supply after minting: ", tokenSupply.toString());

            // Approve the exchange contract to spend owner's tokens
            await token.approve(exchange.address, token_reserves);
            const allowance = await token.allowance(owner.address, exchange.address);
            console.log("Allowance given to exchange: ", allowance.toString());

            // Check owner's balance before pool creation
            const ownerBalance = await token.balanceOf(owner.address);
            console.log("Owner balance before pool creation: ", ownerBalance.toString());

            // Check owner's ETH balance before pool creation
            const ethBalance = await ethers.provider.getBalance(owner.address);
            console.log("Owner ETH balance before pool creation: ", ethBalance.toString());

            // Create the liquidity pool
            await exchange.createPool(token_reserves, { value: eth_reserves });

            // Verify the liquidity pool reserves
            const [tokenReserves, ethReserves] = await exchange.getLiquidity();
            expect(tokenReserves).to.equal(token_reserves);
            expect(ethReserves).to.equal(eth_reserves);
        });
        
        
        it("Should return swap fee", async function () {
            // Deploy the TokenExchange contract
            const TokenExchange = await ethers.getContractFactory("TokenExchange");
            const tokenExchange = await TokenExchange.deploy(); // Deploy the contract
            await tokenExchange.deployed();
        
            // Call the getSwapFee function
            const [numerator, denominator] = await tokenExchange.getSwapFee();
        
            // Check if returned swap fee matches the expected values
            expect(numerator).to.equal(3); // Adjust the expected values as per your contract's initial state
            expect(denominator).to.equal(100);
        });
        

    });

    describe("createPool - Insufficient Tokens", function () {
        it("Should revert if not enough tokens to create the pool", async function () {
            const token_reserves = ethers.utils.parseUnits("1000", 18);
            const eth_reserves = ethers.utils.parseUnits("1", "ether");

            // Mint fewer tokens than required to the owner
            const insufficient_token_reserves = ethers.utils.parseUnits("500", 18);
            await token.mint(insufficient_token_reserves);

            // Approve the exchange contract to spend owner's tokens
            await token.approve(exchange.address, insufficient_token_reserves);

            // Attempt to create the liquidity pool with insufficient tokens
            await expect(
                exchange.createPool(token_reserves, { value: eth_reserves })
            ).to.be.revertedWith("Not have enough tokens to create the pool");
        });
    });
});

        



    


