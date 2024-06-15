const { expect } = require("chai");
const hre = require("hardhat");
const { utils, BigNumber } = require("ethers");

let Token, token, Exchange, exchange, owner, addr1, addr2;
let tokenReserves, ethReserves;

const multiplier = BigNumber.from(10 ** 5);
const swap_fee_numerator = BigNumber.from(3);
const swap_fee_denominator = BigNumber.from(100);

describe("TokenExchange", function () {
	// beforeEach resets the network, deploys contracts, creates liquidity pool
	beforeEach(async function () {
		await hre.network.provider.request({
			method: "hardhat_reset",
			params: [],
		});

		[owner, addr1, addr2] = await hre.ethers.getSigners();

		// Deploy the Token contract
		Token = await hre.ethers.getContractFactory("Token");
		token = await Token.deploy();

		// Deploy the TokenExchange contract
		Exchange = await hre.ethers.getContractFactory("TokenExchange");
		exchange = await Exchange.deploy();

		// Mint tokens to the owner
		const init_token_reserves = utils.parseUnits("5000", 18);
		await token.mint(init_token_reserves);

		// Approve the exchange contract to spend owner's tokens
		await token.approve(exchange.address, init_token_reserves);

		// Create the liquidity pool
		const init_eth_reserves = utils.parseUnits("5000", "ether");
		await exchange.createPool(init_token_reserves, {
			value: init_eth_reserves,
		});
	});

	describe("Special cases", () => {
		it("Should do something if max_slippage is negative", async function () {
			await expect(sendETH(addr1, exchange, "10")).to.be.reverted;
		});
	});
});

/*----------------------------------------------------*/
/*-----------------------functions--------------------*/
async function printLiquidity(exchange) {
	[tokenReserves, ethReserves] = await exchange.getLiquidity();
	console.log(utils.formatUnits(tokenReserves, 18) + " KMS");
	console.log(utils.formatEther(ethReserves) + " ETH");
}

async function sendETH(from, to, amount) {
	console.log(`Sending ${amount} ETH...`);
	const sendingValue = utils.parseEther(amount);
	const gasLimit = 200000;
	const gasPrice = utils.parseUnits("20", "gwei");
	const tx = await from.sendTransaction({
		to: to.address,
		value: sendingValue,
		gasLimit: gasLimit,
		gasPrice: gasPrice,
	});
	return tx;
}
