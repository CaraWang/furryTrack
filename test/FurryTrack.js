// test/FurryTrack-test.js
const { expect } = require("chai");
const helpers = require("@nomicfoundation/hardhat-network-helpers");

describe("FurryTrack contract", function () {
  let FurryTrack;
  let token721;
  let _name='FurryTrack';
  let _symbol='FURRY';
  let dogOwner,vet,otheraccounts;

  beforeEach(async function () {
    FurryTrack = await ethers.getContractFactory("FurryTrack");
    [owner, dogOwner, vet, ...otheraccounts] = await ethers.getSigners();

    token721 = await FurryTrack.deploy();
  });

  // You can nest describe calls to create subsections.
  describe("Deployment", function () {
    it("Should has the correct name and symbol ", async function () {
      expect(await token721.name()).to.equal(_name);
      expect(await token721.symbol()).to.equal(_symbol);
    });
  });

  describe("safeMint()", function() {
    context("mint a new token in FurryTrack by contract owner (breeders or animal shelters)", function () {
      it("can initialize the metadata for this token", async function () {
        await token721.safeMint(true, "baby dog", 0, 0, "ipfs://cid/1.jpg", "good")
        expect(await token721.ownerOf(0)).to.equal(owner.address);
        dataURI = await token721.tokenURI(0)
        expect(dataURI).to.equal(
          "data:application/json;base64,eyJuYW1lIjoiYmFieSBkb2ciLCAiaW1hZ2UiOiAiaXBmczovL2NpZC8xLmpwZyIsICJhdHRyaWJ1dGVzIjpbeyJ0cmFpdF90eXBlIjoiZmF0aGVyIiwidmFsdWUiOjB9LHsidHJhaXRfdHlwZSI6Im1vbnRoZXIiLCJ2YWx1ZSI6MH0seyJ0cmFpdF90eXBlIjoiaGVhbHRoIiwidmFsdWUiOiJnb29kIn0seyJ0cmFpdF90eXBlIjoidHlwZSIsICJ2YWx1ZSI6IkRvZyJ9XX0="
        );

        const metadata = atob(dataURI.substring(29));
        const result = JSON.parse(metadata);
        expect(result.name).to.equal("baby dog")
        expect(result.attributes.length).to.equal(4)
      });
    });
  });

  describe("grantWritePermission()", function() {
    beforeEach(async function () {
      await token721.safeMint(true, "baby dog", 0, 0, "ipfs://cid/1.jpg", "good")
      expect(await token721.ownerOf(0)).to.equal(owner.address);

      await token721.transferFrom(owner.address, dogOwner.address, 0)
      expect(await token721.ownerOf(0)).to.equal(dogOwner.address);

      expect(await token721.isAddressCanWrite(owner.address, 0)).to.equal(false);
      expect(await token721.isAddressCanWrite(dogOwner.address, 0)).to.equal(false);
      expect(await token721.isAddressCanWrite(vet.address, 0)).to.equal(false);

      await helpers.mine(100);
    });

    context("grant write permission to the dog owner", function () {
      it("can not grant permission to dog owner", async function () {
        let messageHash = ethers.utils.id(dogOwner.address);
        let messageBytes = ethers.utils.arrayify(messageHash);
        let signature = await dogOwner.signMessage(messageBytes);

        await expect(
          token721.connect(dogOwner).grantWritePermission(0, dogOwner.address, messageBytes, signature)
        ).to.be.revertedWith("not allow to grant permission to the token owner")
      });
    });

    context("grant write permission to the vet by dog owner", function () {
      it("the vet's wallet can write health status", async function () {
        let messageHash = ethers.utils.id(vet.address);
        let messageBytes = ethers.utils.arrayify(messageHash);
        let signature = await vet.signMessage(messageBytes);

        grant = await token721.connect(dogOwner).grantWritePermission(0, vet.address, messageBytes, signature)
        receipt = await grant.wait()
        expect(receipt.events[0]["event"]).to.equal("GrantWritePermission")

        expect(await token721.isAddressCanWrite(owner.address, 0)).to.equal(false);
        expect(await token721.isAddressCanWrite(dogOwner.address, 0)).to.equal(false);
        expect(await token721.isAddressCanWrite(vet.address, 0)).to.equal(true);
      });

      it("the write permission will be revoked after 128 blocks", async function () {
        let messageHash = ethers.utils.id(vet.address);
        let messageBytes = ethers.utils.arrayify(messageHash);
        let signature = await vet.signMessage(messageBytes);

        grant = await token721.connect(dogOwner).grantWritePermission(0, vet.address, messageBytes, signature)
        receipt = await grant.wait()
        expect(receipt.events[0]["event"]).to.equal("GrantWritePermission")

        await helpers.mine(129);

        expect(await token721.isAddressCanWrite(owner.address, 0)).to.equal(false);
        expect(await token721.isAddressCanWrite(dogOwner.address, 0)).to.equal(false);
        expect(await token721.isAddressCanWrite(vet.address, 0)).to.equal(false);
      });
    });
  });

  describe("updateHealthStatus()", function() {
    context("with vet address", function () {
      beforeEach(async function () {
        await token721.safeMint(true, "baby dog", 0, 0, "ipfs://cid/1.jpg", "good")
        expect(await token721.ownerOf(0)).to.equal(owner.address);

        await token721.transferFrom(owner.address, dogOwner.address, 0)
        expect(await token721.ownerOf(0)).to.equal(dogOwner.address);

        await helpers.mine(100);

        let messageHash = ethers.utils.id(vet.address);
        let messageBytes = ethers.utils.arrayify(messageHash);
        let signature = await vet.signMessage(messageBytes);

        grant = await token721.connect(dogOwner).grantWritePermission(0, vet.address, messageBytes, signature)
        receipt = await grant.wait()
        expect(receipt.events[0]["event"]).to.equal("GrantWritePermission")
        expect(await token721.isAddressCanWrite(vet.address, 0)).to.equal(true);
      });

      it("update health status with the result of the diagnosis", async function () {
        dataURI = await token721.tokenURI(0)
        metadata = atob(dataURI.substring(29));
        result = JSON.parse(metadata);
        expect(result.attributes[2]["value"]).to.equal("good")

        write = await token721.connect(vet).updateHealthStatus(0, "not well")
        receipt = await write.wait()
        expect(receipt.events[0]["event"]).to.equal("StatusChanged")

        dataURI = await token721.tokenURI(0)
        metadata = atob(dataURI.substring(29));
        result = JSON.parse(metadata);
        expect(result.attributes[2]["value"]).to.equal("not well")
      });
    });
  });
});
