const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Upload Contract", function () {
  let upload;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const Upload = await ethers.getContractFactory("Upload");
    upload = await Upload.deploy();
    await upload.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should deploy successfully", async function () {
      const address = await upload.getAddress();
      expect(address).to.be.properAddress;
    });
  });

  describe("add()", function () {
    it("should allow a user to add a URL", async function () {
      await upload.connect(owner).add(owner.address, "ipfs://image1");
      const result = await upload.connect(owner).display(owner.address);
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.equal("ipfs://image1");
    });

    it("should allow adding multiple URLs", async function () {
      await upload.connect(owner).add(owner.address, "ipfs://image1");
      await upload.connect(owner).add(owner.address, "ipfs://image2");
      await upload.connect(owner).add(owner.address, "ipfs://image3");
      const result = await upload.connect(owner).display(owner.address);
      expect(result).to.have.lengthOf(3);
      expect(result[0]).to.equal("ipfs://image1");
      expect(result[1]).to.equal("ipfs://image2");
      expect(result[2]).to.equal("ipfs://image3");
    });
  });

  describe("display()", function () {
    it("should allow owner to view their own data", async function () {
      await upload.connect(owner).add(owner.address, "ipfs://myfile");
      const result = await upload.connect(owner).display(owner.address);
      expect(result[0]).to.equal("ipfs://myfile");
    });

    it("should revert when an unauthorized user tries to view data", async function () {
      await upload.connect(owner).add(owner.address, "ipfs://private");
      await expect(
        upload.connect(user1).display(owner.address)
      ).to.be.revertedWith("You don't have access");
    });

    it("should allow an authorized user to view data after allow()", async function () {
      await upload.connect(owner).add(owner.address, "ipfs://shared");
      await upload.connect(owner).allow(user1.address);
      const result = await upload.connect(user1).display(owner.address);
      expect(result[0]).to.equal("ipfs://shared");
    });
  });

  describe("allow() and disallow()", function () {
    it("should grant access to another user", async function () {
      await upload.connect(owner).add(owner.address, "ipfs://file1");
      await upload.connect(owner).allow(user1.address);

      // user1 should now be able to view owner's data
      const result = await upload.connect(user1).display(owner.address);
      expect(result[0]).to.equal("ipfs://file1");
    });

    it("should revoke access from a user", async function () {
      await upload.connect(owner).add(owner.address, "ipfs://file1");

      // Grant then revoke
      await upload.connect(owner).allow(user1.address);
      await upload.connect(owner).disallow(user1.address);

      // user1 should no longer have access
      await expect(
        upload.connect(user1).display(owner.address)
      ).to.be.revertedWith("You don't have access");
    });

    it("should re-grant access after revoking", async function () {
      await upload.connect(owner).add(owner.address, "ipfs://file1");

      // Grant -> Revoke -> Re-grant
      await upload.connect(owner).allow(user1.address);
      await upload.connect(owner).disallow(user1.address);
      await upload.connect(owner).allow(user1.address);

      // user1 should have access again
      const result = await upload.connect(user1).display(owner.address);
      expect(result[0]).to.equal("ipfs://file1");
    });

    it("should handle multiple users independently", async function () {
      await upload.connect(owner).add(owner.address, "ipfs://file1");

      await upload.connect(owner).allow(user1.address);
      await upload.connect(owner).allow(user2.address);

      // Both should have access
      const result1 = await upload.connect(user1).display(owner.address);
      const result2 = await upload.connect(user2).display(owner.address);
      expect(result1[0]).to.equal("ipfs://file1");
      expect(result2[0]).to.equal("ipfs://file1");

      // Revoke only user1
      await upload.connect(owner).disallow(user1.address);

      // user1 should lose access, user2 should keep it
      await expect(
        upload.connect(user1).display(owner.address)
      ).to.be.revertedWith("You don't have access");

      const result2Again = await upload.connect(user2).display(owner.address);
      expect(result2Again[0]).to.equal("ipfs://file1");
    });
  });

  describe("shareAccess()", function () {
    it("should return empty array when no access has been shared", async function () {
      const result = await upload.connect(owner).shareAccess();
      expect(result).to.have.lengthOf(0);
    });

    it("should return the list of users with access status", async function () {
      await upload.connect(owner).allow(user1.address);
      const result = await upload.connect(owner).shareAccess();
      expect(result).to.have.lengthOf(1);
      expect(result[0].user).to.equal(user1.address);
      expect(result[0].access).to.equal(true);
    });

    it("should reflect revoked access in the access list", async function () {
      await upload.connect(owner).allow(user1.address);
      await upload.connect(owner).disallow(user1.address);
      const result = await upload.connect(owner).shareAccess();
      expect(result).to.have.lengthOf(1);
      expect(result[0].user).to.equal(user1.address);
      expect(result[0].access).to.equal(false);
    });

    it("should show multiple shared users", async function () {
      await upload.connect(owner).allow(user1.address);
      await upload.connect(owner).allow(user2.address);
      const result = await upload.connect(owner).shareAccess();
      expect(result).to.have.lengthOf(2);
      expect(result[0].user).to.equal(user1.address);
      expect(result[1].user).to.equal(user2.address);
    });
  });
});
