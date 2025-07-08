import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import hre from "hardhat";
import { parseEther, getAddress, zeroAddress } from "viem";
import { expect, assert } from "chai";

describe("NftMarketplace", () => {
  const deployNftMarketplaceFixture = async () => {
    const TOKEN_ID = 0n;
    const PRICE = parseEther("0.1");

    const [deployer, player] = await hre.viem.getWalletClients();

    const nftMarketplace = await hre.viem.deployContract("NftMarketplace", [], {
      client: { wallet: deployer },
    });

    const basicNft = await hre.viem.deployContract("BasicNft", [], {
      client: { wallet: deployer },
    });
    await basicNft.write.mintNFT();
    await basicNft.write.approve([nftMarketplace.address, TOKEN_ID]);

    const publicClient = await hre.viem.getPublicClient();

    return {
      TOKEN_ID,
      PRICE,
      nftMarketplace,
      basicNft,
      publicClient,
      deployer,
      player,
    };
  };

  describe("listItem", () => {
    it("emits an event after listing an item", async () => {
      const {
        nftMarketplace,
        basicNft,
        TOKEN_ID,
        PRICE,
        publicClient,
        deployer,
      } = await loadFixture(deployNftMarketplaceFixture);

      const hash = await nftMarketplace.write.listItem([
        basicNft.address,
        TOKEN_ID,
        PRICE,
      ]);

      await publicClient.waitForTransactionReceipt({ hash });

      const itemListedEvents = await nftMarketplace.getEvents.ItemListed();
      expect(itemListedEvents).to.have.lengthOf(1);
      expect(itemListedEvents[0].args.nftAddress).to.equal(
        getAddress(basicNft.address)
      );
      expect(itemListedEvents[0].args.tokenId).to.equal(TOKEN_ID);
      expect(itemListedEvents[0].args.seller).to.equal(
        getAddress(deployer.account.address)
      );
      expect(itemListedEvents[0].args.price).to.equal(PRICE);
    });

    it("exclusively items that haven't been listed", async () => {
      const { nftMarketplace, basicNft, TOKEN_ID, PRICE } = await loadFixture(
        deployNftMarketplaceFixture
      );
      await nftMarketplace.write.listItem([basicNft.address, TOKEN_ID, PRICE]);
      const error = `NftMarketplace__AlreadyListed("${getAddress(
        basicNft.address
      )}", ${TOKEN_ID})`;
      await expect(
        nftMarketplace.write.listItem([basicNft.address, TOKEN_ID, PRICE])
      ).to.be.rejectedWith("NftMarketplace__AlreadyListed");
      await expect(
        nftMarketplace.write.listItem([basicNft.address, TOKEN_ID, PRICE])
      ).to.be.rejectedWith(error);
    });

    it("exclusively allows owners to list", async () => {
      const { nftMarketplace, basicNft, TOKEN_ID, PRICE, deployer, player } =
        await loadFixture(deployNftMarketplaceFixture);

      const owner = await basicNft.read.ownerOf([TOKEN_ID]);
      expect(owner).to.equal(getAddress(deployer.account.address));
      expect(owner).to.not.equal(getAddress(player.account.address));

      await basicNft.write.approve([player.account.address, TOKEN_ID]);

      await expect(
        nftMarketplace.write.listItem([basicNft.address, TOKEN_ID, PRICE], {
          account: player.account,
        })
      ).to.be.rejectedWith("NftMarketplace__NotOwner");
    });

    it("reverts if the price is set to 0", async () => {
      const { nftMarketplace, basicNft, TOKEN_ID } = await loadFixture(
        deployNftMarketplaceFixture
      );
      await expect(
        nftMarketplace.write.listItem([basicNft.address, TOKEN_ID, 0n])
      ).to.be.rejectedWith("NftMarketplace__PriceMustBeAboveZero");
    });

    it("needs approvals to list item", async () => {
      const { nftMarketplace, basicNft, TOKEN_ID, PRICE } = await loadFixture(
        deployNftMarketplaceFixture
      );
      await basicNft.write.approve([zeroAddress, TOKEN_ID]);
      await expect(
        nftMarketplace.write.listItem([basicNft.address, TOKEN_ID, PRICE])
      ).to.be.rejectedWith("NftMarketplace__NotApprovedForMarketplace");
    });

    it("updates listing with seller and price", async () => {
      const { nftMarketplace, basicNft, TOKEN_ID, PRICE, deployer } =
        await loadFixture(deployNftMarketplaceFixture);

      await nftMarketplace.write.listItem([basicNft.address, TOKEN_ID, PRICE]);
      const listing = await nftMarketplace.read.getListing([
        basicNft.address,
        TOKEN_ID,
      ]);
      assert.equal(listing.seller, getAddress(deployer.account.address));
      assert.equal(listing.price, PRICE);
    });
  });
});
