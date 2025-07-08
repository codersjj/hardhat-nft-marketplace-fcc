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

  describe("buyItem", () => {
    it("reverts if the item is not listed", async () => {
      const { nftMarketplace, basicNft, TOKEN_ID, PRICE } = await loadFixture(
        deployNftMarketplaceFixture
      );

      await expect(
        nftMarketplace.write.buyItem([basicNft.address, TOKEN_ID], {
          value: PRICE,
        })
      ).to.be.rejectedWith("NftMarketplace__NotListed");
    });

    it("reverts if the price is not met", async () => {
      const { nftMarketplace, basicNft, TOKEN_ID, PRICE } = await loadFixture(
        deployNftMarketplaceFixture
      );

      await nftMarketplace.write.listItem([basicNft.address, TOKEN_ID, PRICE]);

      const tooLowPrice = PRICE - 1n;
      await expect(
        nftMarketplace.write.buyItem([basicNft.address, TOKEN_ID], {
          value: tooLowPrice,
        })
      ).to.be.rejectedWith("NftMarketplace__PriceNotMet");
    });

    it("updates internal proceeds record for the seller and transfer the NFT to the buyer", async () => {
      const {
        nftMarketplace,
        basicNft,
        TOKEN_ID,
        PRICE,
        deployer,
        player,
        publicClient,
      } = await loadFixture(deployNftMarketplaceFixture);

      await nftMarketplace.write.listItem([basicNft.address, TOKEN_ID, PRICE]);

      const deployerProceedsBefore = await nftMarketplace.read.getProceeds([
        deployer.account.address,
      ]);

      const hash = await nftMarketplace.write.buyItem(
        [basicNft.address, TOKEN_ID],
        {
          value: PRICE,
          account: player.account,
        }
      );
      await publicClient.waitForTransactionReceipt({ hash });

      const itemBoughtEvents = await nftMarketplace.getEvents.ItemBought();
      expect(itemBoughtEvents).to.have.lengthOf(1);
      expect(itemBoughtEvents[0].args.buyer).to.equal(
        getAddress(player.account.address)
      );
      expect(itemBoughtEvents[0].args.nftAddress).to.equal(
        getAddress(basicNft.address)
      );
      expect(itemBoughtEvents[0].args.tokenId).to.equal(TOKEN_ID);
      expect(itemBoughtEvents[0].args.price).to.equal(PRICE);

      const deployerProceedsAfter = await nftMarketplace.read.getProceeds([
        deployer.account.address,
      ]);
      const newOwner = await basicNft.read.ownerOf([TOKEN_ID]);

      assert.equal(deployerProceedsAfter, deployerProceedsBefore + PRICE);
      assert.equal(newOwner, getAddress(player.account.address));
    });
  });

  describe("cancelItem", () => {
    it("reverts if anyone but the owner tries to cancel", async () => {
      const { nftMarketplace, basicNft, TOKEN_ID, PRICE, player } =
        await loadFixture(deployNftMarketplaceFixture);
      await nftMarketplace.write.listItem([basicNft.address, TOKEN_ID, PRICE]);
      await expect(
        nftMarketplace.write.cancelItem([basicNft.address, TOKEN_ID], {
          account: player.account,
        })
      ).to.be.rejectedWith("NftMarketplace__NotOwner");
    });

    it("reverts if the item is not listed", async () => {
      const { nftMarketplace, basicNft, TOKEN_ID, PRICE } = await loadFixture(
        deployNftMarketplaceFixture
      );
      const error = `NftMarketplace__NotListed("${getAddress(
        basicNft.address
      )}", ${TOKEN_ID})`;

      await expect(
        nftMarketplace.write.buyItem([basicNft.address, TOKEN_ID], {
          value: PRICE,
        })
      ).to.be.rejectedWith(error);
    });

    it("removes the listing and emits an event", async () => {
      const {
        nftMarketplace,
        basicNft,
        TOKEN_ID,
        PRICE,
        deployer,
        publicClient,
      } = await loadFixture(deployNftMarketplaceFixture);

      await nftMarketplace.write.listItem([basicNft.address, TOKEN_ID, PRICE]);

      const hash = await nftMarketplace.write.cancelItem([
        basicNft.address,
        TOKEN_ID,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const itemCancelledEvents = await nftMarketplace.getEvents.ItemCanceled();
      expect(itemCancelledEvents).to.have.lengthOf(1);
      expect(itemCancelledEvents[0].args.seller).to.equal(
        getAddress(deployer.account.address)
      );
      expect(itemCancelledEvents[0].args.nftAddress).to.equal(
        getAddress(basicNft.address)
      );
      expect(itemCancelledEvents[0].args.tokenId).to.equal(TOKEN_ID);

      const listing = await nftMarketplace.read.getListing([
        basicNft.address,
        TOKEN_ID,
      ]);
      assert.equal(listing.seller, zeroAddress);
    });
  });

  describe("updateListing", () => {
    it("reverts if the item is not listed", async () => {
      const { nftMarketplace, basicNft, TOKEN_ID, PRICE } = await loadFixture(
        deployNftMarketplaceFixture
      );
      const error = `NftMarketplace__NotListed("${getAddress(
        basicNft.address
      )}", ${TOKEN_ID})`;

      await expect(
        nftMarketplace.write.updateListing([
          basicNft.address,
          TOKEN_ID,
          PRICE * 2n,
        ])
      ).to.be.rejectedWith(error);
    });

    it("reverts if anyone but the owner tries to update", async () => {
      const { nftMarketplace, basicNft, TOKEN_ID, PRICE, player } =
        await loadFixture(deployNftMarketplaceFixture);
      await nftMarketplace.write.listItem([basicNft.address, TOKEN_ID, PRICE]);
      await expect(
        nftMarketplace.write.updateListing(
          [basicNft.address, TOKEN_ID, PRICE * 2n],
          { account: player.account }
        )
      ).to.be.rejectedWith("NftMarketplace__NotOwner");
    });

    it("reverts if the price is set to 0", async () => {
      const { nftMarketplace, basicNft, TOKEN_ID, PRICE } = await loadFixture(
        deployNftMarketplaceFixture
      );
      await nftMarketplace.write.listItem([basicNft.address, TOKEN_ID, PRICE]);
      await expect(
        nftMarketplace.write.updateListing([basicNft.address, TOKEN_ID, 0n])
      ).to.be.rejectedWith("NftMarketplace__PriceMustBeAboveZero");
    });

    it("updates the price of the listing and emits an event", async () => {
      const {
        nftMarketplace,
        basicNft,
        TOKEN_ID,
        PRICE,
        deployer,
        publicClient,
      } = await loadFixture(deployNftMarketplaceFixture);
      await nftMarketplace.write.listItem([basicNft.address, TOKEN_ID, PRICE]);
      const newPrice = PRICE * 2n;
      const hash = await nftMarketplace.write.updateListing([
        basicNft.address,
        TOKEN_ID,
        newPrice,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const itemListedEvents = await nftMarketplace.getEvents.ItemListed();
      const listing = await nftMarketplace.read.getListing([
        basicNft.address,
        TOKEN_ID,
      ]);

      expect(itemListedEvents).to.have.lengthOf(1);
      const { nftAddress, tokenId, seller, price } = itemListedEvents[0].args;
      expect(nftAddress).to.equal(getAddress(basicNft.address));
      expect(tokenId).to.equal(TOKEN_ID);
      expect(seller).to.equal(getAddress(deployer.account.address));
      expect(price).to.equal(newPrice);

      assert.equal(listing.price, newPrice);
    });
  });

  describe("withdrawProceeds", () => {
    it("doesn't allow 0 proceed withdrawls", async () => {
      const { nftMarketplace } = await loadFixture(deployNftMarketplaceFixture);
      await expect(nftMarketplace.write.withdrawProceeds()).to.be.rejectedWith(
        "NftMarketplace__NoProceeds"
      );
    });

    it("withdraws proceeds", async () => {
      const {
        nftMarketplace,
        basicNft,
        TOKEN_ID,
        PRICE,
        deployer,
        player,
        publicClient,
      } = await loadFixture(deployNftMarketplaceFixture);
      await nftMarketplace.write.listItem([basicNft.address, TOKEN_ID, PRICE]);
      await nftMarketplace.write.buyItem([basicNft.address, TOKEN_ID], {
        value: PRICE,
        account: player.account,
      });
      const sellerProceedsBefore = await nftMarketplace.read.getProceeds([
        deployer.account.address,
      ]);
      const sellerBalanceBefore = await publicClient.getBalance({
        address: deployer.account.address,
      });
      const hash = await nftMarketplace.write.withdrawProceeds();
      const txReceipt = await publicClient.waitForTransactionReceipt({ hash });
      const { gasUsed, effectiveGasPrice } = txReceipt;

      const sellerProceedsAfter = await nftMarketplace.read.getProceeds([
        deployer.account.address,
      ]);
      const sellerBalanceAfter = await publicClient.getBalance({
        address: deployer.account.address,
      });

      assert.equal(sellerProceedsAfter, 0n);
      assert.equal(
        sellerBalanceAfter + gasUsed * effectiveGasPrice,
        sellerBalanceBefore + sellerProceedsBefore
      );
    });
  });
});
