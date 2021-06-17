import chai from "chai";
import chaiSubset from "chai-subset";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { ContractFactory, Signer, BigNumber, utils } from "ethers";
import { VotingEscrow } from "../../types/VotingEscrow";
import {RewardVesting} from "../../types/RewardVesting";

import { Erc20Mock } from "../../types/Erc20Mock";
import { getAddress, parseEther } from "ethers/lib/utils";
import { MAXIMUM_U256, ZERO_ADDRESS, mineBlocks, increaseTime } from "../utils/helpers";

chai.use(solidity);
chai.use(chaiSubset);

const { expect } = chai;
const EPSILON = 3;
let VotingEscrowFactory: ContractFactory;
let RewardVestingFactory: ContractFactory;
let ERC20MockFactory: ContractFactory;

describe("VotingEscrow", () => {
  let deployer: Signer;
  let player: Signer;
  let player2: Signer;
  let collector: Signer;
  let governance: Signer;
  let newGovernance: Signer;
  let newCollector: Signer;
  let signers: Signer[];

  let votingEscrow: VotingEscrow;
  let votingEscrowWithoutVesting: VotingEscrow;
  let wasabiRewardVesting: RewardVesting;
  let rewardVesting1: RewardVesting;
  let rewardVesting2: RewardVesting;
  let rewardVesting3: RewardVesting;
  let wasabi: Erc20Mock;
  let reward1: Erc20Mock;
  let reward2: Erc20Mock;
  let reward3: Erc20Mock;

  before(async () => {
    VotingEscrowFactory = await ethers.getContractFactory("VotingEscrow");
    ERC20MockFactory = await ethers.getContractFactory("ERC20Mock");
    RewardVestingFactory = await ethers.getContractFactory("RewardVesting");
  });

  beforeEach(async () => {
    [deployer, player, collector, player2, governance, newGovernance, newCollector, ...signers] = await ethers.getSigners();

    wasabi = (await ERC20MockFactory.connect(deployer).deploy(
      "WASABI Token",
      "WASABI",
      18
    )) as Erc20Mock;

    reward1 = (await ERC20MockFactory.connect(deployer).deploy(
      "REWARD Token 1",
      "REWARD1",
      18
    )) as Erc20Mock;

    reward2 = (await ERC20MockFactory.connect(deployer).deploy(
      "REWARD Token 2",
      "REWARD2",
      18
    )) as Erc20Mock;

    reward3 = (await ERC20MockFactory.connect(deployer).deploy(
      "REWARD Token 3",
      "REWARD3",
      18
    )) as Erc20Mock;

    wasabiRewardVesting = (await RewardVestingFactory.connect(deployer).deploy(await governance.getAddress())) as RewardVesting;
    await wasabiRewardVesting.connect(governance).initialize(wasabi.address,60,300);

    rewardVesting1 = (await RewardVestingFactory.connect(deployer).deploy(await governance.getAddress())) as RewardVesting;
    await rewardVesting1.connect(governance).initialize(reward1.address,60,300);

    rewardVesting2 = (await RewardVestingFactory.connect(deployer).deploy(await governance.getAddress())) as RewardVesting;
    await rewardVesting2.connect(governance).initialize(reward2.address,60,300);

    rewardVesting3 = (await RewardVestingFactory.connect(deployer).deploy(await governance.getAddress())) as RewardVesting;
    await rewardVesting3.connect(governance).initialize(reward3.address,60,300);

    votingEscrow = (await VotingEscrowFactory.connect(deployer).deploy(await governance.getAddress())) as VotingEscrow;

    votingEscrowWithoutVesting = (await VotingEscrowFactory.connect(deployer).deploy(await governance.getAddress())) as VotingEscrow;
  });

  describe("initialize", () => {
    it("only allows once", async () => {
      await votingEscrow.connect(governance).initialize(wasabi.address,0,true,wasabiRewardVesting.address,[reward1.address, reward2.address],[rewardVesting1.address, rewardVesting2.address], [false, false], await collector.getAddress());

      expect(votingEscrow.connect(governance).initialize(wasabi.address,0,true,wasabiRewardVesting.address,[reward1.address, reward2.address],[rewardVesting1.address, rewardVesting2.address], [false, false], await collector.getAddress()))
        .revertedWith("VotingEscrow: already initialized");
    });

    it("only allows governance", async () => {
      expect(votingEscrow.connect(player).initialize(wasabi.address,0,true,wasabiRewardVesting.address,[reward1.address, reward2.address],[rewardVesting1.address, rewardVesting2.address], [false, false], await collector.getAddress()))
        .revertedWith("VotingEscrow: only governance");
    });

    it('prevents create lock when not initialized', async () => {
      expect(votingEscrow.connect(player).createLock(10000, 0)).revertedWith(
        "VotingEscrow: not initialized."
      );
    });

    it('prevents add amount when not initialized', async () => {
      expect(votingEscrow.connect(player).addAmount(5000)).revertedWith(
        "VotingEscrow: not initialized."
      );
    });

    it('prevents extend lock when not initialized', async () => {
      expect(votingEscrow.connect(player).extendLock(0)).revertedWith(
        "VotingEscrow: not initialized."
      );
    });

    it('prevents withdraw when not initialized', async () => {
      expect(votingEscrow.connect(player).withdraw()).revertedWith(
        "VotingEscrow: not initialized."
      );
    });

    it('prevents vest earning when not initialized', async () => {
      expect(votingEscrow.connect(player).vestEarning()).revertedWith(
        "VotingEscrow: not initialized."
      );
    });

    it('prevents collect reward when not initialized', async () => {
      expect(votingEscrow.connect(player).collectReward()).revertedWith(
        "VotingEscrow: not initialized."
      );
    });

    context("when caller is governance", () => {
      beforeEach(async () => {
        votingEscrow = votingEscrow.connect(governance);
      });

      it("prevents reward token and reward vesting length mistmatch", async () => {
        expect(votingEscrow.connect(governance)
          .initialize(wasabi.address,
                      0,true,wasabiRewardVesting.address,
                      [reward1.address, reward2.address, reward3.address],
                      [rewardVesting1.address, rewardVesting2.address],
                      [false, false],
                      await collector.getAddress()))
            .revertedWith(
              "VotingEscrow: reward token and reward vesting length mismatch"
            );
      });

      it("prevents reward token and need vesting length mistmatch", async () => {
        expect(votingEscrow.connect(governance)
          .initialize(wasabi.address,
                      0,true,wasabiRewardVesting.address,
                      [reward1.address, reward2.address],
                      [rewardVesting1.address, rewardVesting2.address],
                      [false, false, false],
                      await collector.getAddress()))
            .revertedWith(
              "VotingEscrow: reward token and need vesting length mismatch"
            );
      });

      it("prevents zero collector address", async () => {
        expect(votingEscrow.connect(governance)
          .initialize(wasabi.address,
                      0,true,wasabiRewardVesting.address,
                      [reward1.address, reward2.address],
                      [rewardVesting1.address, rewardVesting2.address],
                      [false, false],
                      ZERO_ADDRESS))
            .revertedWith(
              "VotingEscrow: collector address cannot be 0x0"
            );
      });

      it("sets initialized to true", async () => {
        expect(await votingEscrow.initialized()).equal(false);
        await votingEscrow.connect(governance).initialize(wasabi.address,0,true,wasabiRewardVesting.address,[reward1.address, reward2.address],[rewardVesting1.address, rewardVesting2.address], [false, false], await collector.getAddress());
        expect(await votingEscrow.initialized()).equal(true);
      });
    });
  });

  describe("set governance", () => {
    it("only allows governance", async () => {
      expect(votingEscrow.connect(player).setPendingGovernance(await newGovernance.getAddress())).revertedWith(
        "VotingEscrow: only governance"
      );
    });

    context("when caller is governance", () => {
      beforeEach(async () => {
        votingEscrow = votingEscrow.connect(governance);
      });

      it("prevents getting stuck", async () => {
        expect(votingEscrow.setPendingGovernance(ZERO_ADDRESS)).revertedWith(
          "VotingEscrow: pending governance address cannot be 0x0"
        );
      });

      it("sets the pending governance", async () => {
        await votingEscrow.setPendingGovernance(await newGovernance.getAddress());
        expect(await votingEscrow.governance()).equal(await governance.getAddress());
      });

      it("updates governance upon acceptance", async () => {
        await votingEscrow.setPendingGovernance(await newGovernance.getAddress());
        await votingEscrow.connect(newGovernance).acceptGovernance()
        expect(await votingEscrow.governance()).equal(await newGovernance.getAddress());
      });

      it("emits GovernanceUpdated event", async () => {
        await votingEscrow.setPendingGovernance(await newGovernance.getAddress());
        expect(votingEscrow.connect(newGovernance).acceptGovernance())
          .emit(votingEscrow, "GovernanceUpdated")
          .withArgs(await newGovernance.getAddress());
      });
    });
  });

  describe("set collector", () => {
    it("only allows governance", async () => {
      expect(votingEscrow.connect(player).setCollector(await newCollector.getAddress())).revertedWith(
        "VotingEscrow: only governance"
      );
    });

    context("when caller is governance", () => {
      beforeEach(async () => {
        votingEscrow = votingEscrow.connect(governance);
      });

      it("prevents getting stuck", async () => {
        expect(votingEscrow.setCollector(ZERO_ADDRESS)).revertedWith(
          "VotingEscrow: collector address cannot be 0x0"
        );
      });

      it("sets the collector", async () => {
        await votingEscrow.setCollector(await newCollector.getAddress());
        expect(await votingEscrow.collector()).equal(await newCollector.getAddress());
      });

      it("emits CollectorUpdated event", async () => {
        expect(votingEscrow.setCollector(await newCollector.getAddress()))
          .emit(votingEscrow, "CollectorUpdated")
          .withArgs(await newCollector.getAddress());
      });
    });
  });

  context("after initialized", () => {
    beforeEach(async () => {
      await votingEscrow.connect(governance)
        .initialize(wasabi.address,0,true,wasabiRewardVesting.address,
                   [reward1.address, reward2.address],[rewardVesting1.address, rewardVesting2.address], [true, true],
                   await collector.getAddress());
      await votingEscrowWithoutVesting.connect(governance)
        .initialize(wasabi.address,0,false,ZERO_ADDRESS,
                   [reward1.address, reward2.address],[ZERO_ADDRESS, ZERO_ADDRESS], [false, false],
                   await collector.getAddress());
    });

    describe("set wasabi reward rate", () => {
      it("only allows governance", async () => {
        expect(votingEscrow.connect(player).setWasabiRewardRate(100)).revertedWith(
          "VotingEscrow: only governance"
        );
      });

      context("when caller is governance", () => {
        beforeEach(async () => {
          votingEscrow = votingEscrow.connect(governance);
        });

        it("sets the new reward rate", async () => {
          await votingEscrow.setWasabiRewardRate(100);
          expect(await votingEscrow.wasabiRewardRate()).equal(100);
        });

        it("emits WasabiRewardRateUpdated event", async () => {
          expect(votingEscrow.setWasabiRewardRate(100))
            .emit(votingEscrow, "WasabiRewardRateUpdated")
            .withArgs(100);
        });
      });
    });

    describe("set wasabi vesting", () => {
      it("only allows governance", async () => {
        expect(votingEscrow.connect(player).setWasabiVesting(false, ZERO_ADDRESS)).revertedWith(
          "VotingEscrow: only governance"
        );
      });

      context("when caller is governance", () => {
        beforeEach(async () => {
          votingEscrow = votingEscrow.connect(governance);
        });

        it("prevents adding zero address reward token when need vesting", async () => {
          expect(votingEscrow.setWasabiVesting(true, ZERO_ADDRESS)).revertedWith(
            "VotingEscrow: new wasabi reward vesting address cannot be 0x0"
          );
        });

        it("sets the new vesting", async () => {
          await votingEscrow.setWasabiVesting(false, ZERO_ADDRESS);
          expect(await votingEscrow.wasabiNeedVesting()).equal(false);
          expect(await votingEscrow.wasabiVestingAddress()).equal(ZERO_ADDRESS);
        });

        it("emits WasabiVestingUpdated event", async () => {
          expect(votingEscrow.setWasabiVesting(false, ZERO_ADDRESS))
            .emit(votingEscrow, "WasabiVestingUpdated")
            .withArgs(false, ZERO_ADDRESS);
        });
      });
    });

    describe("add reward token", () => {
      it("only allows governance", async () => {
        expect(votingEscrow.connect(player).addRewardToken(reward3.address, rewardVesting3.address, true)).revertedWith(
          "VotingEscrow: only governance"
        );
      });

      context("when caller is governance", () => {
        beforeEach(async () => {
          votingEscrow = votingEscrow.connect(governance);
        });

        it("prevents adding zero address reward token when need vesting", async () => {
          expect(votingEscrow.addRewardToken(ZERO_ADDRESS, rewardVesting3.address, true)).revertedWith(
            "VotingEscrow: new reward token address cannot be 0x0"
          );
        });

        it("can add new reward token with zero reward vesting address when don't need vesting", async () => {
          expect(await votingEscrow.rewardTokensLength()).equal(2);

          await votingEscrow.addRewardToken(reward3.address, ZERO_ADDRESS, false);

          expect(await votingEscrow.rewardTokensLength()).equal(3);
          expect(await votingEscrow.rewardTokens(2)).equal(reward3.address);
          expect(await votingEscrow.rewardVestings(2)).equal(ZERO_ADDRESS);
          expect(await votingEscrow.needVestings(2)).equal(false);
        });

        it("prevents adding zero address reward vesting", async () => {
          expect(votingEscrow.addRewardToken(reward3.address, ZERO_ADDRESS, true)).revertedWith(
            "VotingEscrow: new reward vesting address cannot be 0x0"
          );
        });

        it("can add new reward token along with reward vesting address", async () => {
          expect(await votingEscrow.rewardTokensLength()).equal(2);

          await votingEscrow.addRewardToken(reward3.address, rewardVesting3.address, true);
          expect(await votingEscrow.rewardTokensLength()).equal(3);
          expect(await votingEscrow.rewardTokens(2)).equal(reward3.address);
          expect(await votingEscrow.rewardVestings(2)).equal(rewardVesting3.address);
          expect(await votingEscrow.needVestings(2)).equal(true);
        });

        it("emits RewardTokenAdded event", async () => {
          expect(votingEscrow.addRewardToken(reward3.address, rewardVesting3.address, true))
            .emit(votingEscrow, "RewardTokenAdded")
            .withArgs(reward3.address, rewardVesting3.address, true);
        });
      });
    });

    describe("voting escrow actions", () => {

      context("create lock", () => {
        let mintAmount = 1000000;

        beforeEach(async () => {
          await wasabi.mint(await player.getAddress(), mintAmount);
          await wasabi.connect(player).approve(votingEscrow.address, MAXIMUM_U256);
        });

        it("cannot create lock with zero amount", async () => {
          expect(votingEscrow.connect(player).createLock(0, 0)).revertedWith(
            "amount must be non-zero"
          );
        });

        it("cannot create lock when there's existing lock", async () => {
          await votingEscrow.connect(player).createLock(10000, 0);
          expect(votingEscrow.connect(player).createLock(10000, 0)).revertedWith(
            "must no locked"
          );
        });

        it("cannot create lock for other than 7, 30, 90 ,180, 360 or 1440 days", async () => {
          const lockAmount: number = 10000;
          //LockDays enum (0: 30days, 1: 60days, 2:90days)
          expect(votingEscrow.connect(player).createLock(lockAmount, 6)).reverted;
        });

        it("can create lock for 7 days", async () => {
          const lockAmount: number = 30000;
          const lockSeconds: number = 86400*7;

          expect(await wasabi.balanceOf(votingEscrow.address)).equal(0);
          expect(await wasabi.balanceOf(await player.getAddress())).equal(mintAmount);

          //LockDays enum (0: 7days, 1: 30days, 2:90days)
          await votingEscrow.connect(player).createLock(lockAmount, 0);

          expect(await wasabi.balanceOf(votingEscrow.address)).equal(lockAmount);
          expect(await wasabi.balanceOf(await player.getAddress())).equal(mintAmount-lockAmount);

          expect(await votingEscrow.amountOf(await player.getAddress())).equal(lockAmount);

          const startTime = Number(await votingEscrow.startOf(await player.getAddress()));
          expect(await votingEscrow.endOf(await player.getAddress())).equal(startTime + lockSeconds);

          expect(await votingEscrow.balanceOf(await player.getAddress())).equal(BigNumber.from(lockAmount).mul(7).div(1440));

          expect(await votingEscrow.balanceAt(await player.getAddress(),startTime + lockSeconds/2)).gte(BigNumber.from(lockAmount).mul(7).div(1440).div(2).sub(EPSILON)).lte(BigNumber.from(lockAmount).mul(7).div(1440).div(2).add(EPSILON));
          expect(await votingEscrow.balanceAt(await player.getAddress(),startTime + lockSeconds)).equal(0);
        });

        it("can create lock for 30 days", async () => {
          const lockAmount: number = 30000;
          const lockSeconds: number = 86400*30;

          expect(await wasabi.balanceOf(votingEscrow.address)).equal(0);
          expect(await wasabi.balanceOf(await player.getAddress())).equal(mintAmount);

          //LockDays enum (0: 7days, 1: 30days, 2:90days)
          await votingEscrow.connect(player).createLock(lockAmount, 1);

          expect(await wasabi.balanceOf(votingEscrow.address)).equal(lockAmount);
          expect(await wasabi.balanceOf(await player.getAddress())).equal(mintAmount-lockAmount);

          expect(await votingEscrow.amountOf(await player.getAddress())).equal(lockAmount);

          const startTime = Number(await votingEscrow.startOf(await player.getAddress()));
          expect(await votingEscrow.endOf(await player.getAddress())).equal(startTime + lockSeconds);

          expect(await votingEscrow.balanceOf(await player.getAddress())).equal(BigNumber.from(lockAmount).mul(30).div(1440));

          expect(await votingEscrow.balanceAt(await player.getAddress(),startTime + lockSeconds/2)).gte(BigNumber.from(lockAmount).mul(30).div(1440).div(2).sub(EPSILON)).lte(BigNumber.from(lockAmount).mul(30).div(1440).div(2).add(EPSILON));
          expect(await votingEscrow.balanceAt(await player.getAddress(),startTime + lockSeconds)).equal(0);
        });

        it("can create lock for 90 days", async () => {
          const lockAmount: number = 30000;
          const lockSeconds: number = 86400*90;

          expect(await wasabi.balanceOf(votingEscrow.address)).equal(0);
          expect(await wasabi.balanceOf(await player.getAddress())).equal(mintAmount);

          //LockDays enum (0: 7days, 1: 30days, 2:90days)
          await votingEscrow.connect(player).createLock(lockAmount, 2);

          expect(await wasabi.balanceOf(votingEscrow.address)).equal(lockAmount);
          expect(await wasabi.balanceOf(await player.getAddress())).equal(mintAmount-lockAmount);

          expect(await votingEscrow.amountOf(await player.getAddress())).equal(lockAmount);

          const startTime = Number(await votingEscrow.startOf(await player.getAddress()));
          expect(await votingEscrow.endOf(await player.getAddress())).equal(startTime + lockSeconds);

          expect(await votingEscrow.balanceOf(await player.getAddress())).equal(lockAmount*90/1440);
        });

        it("can create lock for 1440 days", async () => {
          const lockAmount: number = 30000;
          const lockSeconds: number = 86400*1440;

          expect(await wasabi.balanceOf(votingEscrow.address)).equal(0);
          expect(await wasabi.balanceOf(await player.getAddress())).equal(mintAmount);

          //LockDays enum (0: 7days, 1: 30days, 2:90days, 3:180days,4:360days,5:1440days)
          await votingEscrow.connect(player).createLock(lockAmount, 5);

          expect(await wasabi.balanceOf(votingEscrow.address)).equal(lockAmount);
          expect(await wasabi.balanceOf(await player.getAddress())).equal(mintAmount-lockAmount);

          expect(await votingEscrow.amountOf(await player.getAddress())).equal(lockAmount);

          const startTime = Number(await votingEscrow.startOf(await player.getAddress()));
          expect(await votingEscrow.endOf(await player.getAddress())).equal(startTime + lockSeconds);

          expect(await votingEscrow.balanceOf(await player.getAddress())).equal(lockAmount*1440/1440);
        });
      });

      context("extend lock", () => {
        let mintAmount = 1000000;

        beforeEach(async () => {
          await wasabi.mint(await player.getAddress(), mintAmount);
          await wasabi.connect(player).approve(votingEscrow.address, MAXIMUM_U256);
        });

        it("cannot extend lock when there's no existing lock", async () => {
          //ExtendDays enum (0: 7days, 1: 30days, 2:90days)
          expect(votingEscrow.connect(player).extendLock(0)).revertedWith(
            "must locked"
          );
        });

        describe("with exsiting lock", () => {
          it("cannot extend lock to a total duration more than 90 days", async () => {
            const lockAmount: number = 30000;
            //LockDays enum (0: 7days, 1: 30days, 2:90days)
            await votingEscrow.connect(player).createLock(lockAmount, 0);

            //ExtendDays enum (0: 7days, 1: 30days, 2:90days)
            await votingEscrow.connect(player).extendLock(1); //7+30
            expect(votingEscrow.connect(player).extendLock(5)).revertedWith(
              "end too long"
            ); //7+30+1440
          });

          it("can extend lock", async () => {
            const lockAmount: number = 30000;

            const lockTimestamp = Math.floor(Date.now()/1000);
            //LockDays enum (0: 7days, 1: 30days, 2:90days)
            await votingEscrow.connect(player).createLock(lockAmount, 0);

            expect(await wasabi.balanceOf(votingEscrow.address)).equal(lockAmount);
            expect(await wasabi.balanceOf(await player.getAddress())).equal(mintAmount-lockAmount);
            expect(await votingEscrow.amountOf(await player.getAddress())).equal(lockAmount);
            expect(await votingEscrow.balanceOf(await player.getAddress())).equal(BigNumber.from(lockAmount).mul(7).div(1440));

            const lockSeconds = 86400*7; //7
            const startTime = Number(await votingEscrow.startOf(await player.getAddress()));
            expect(await votingEscrow.endOf(await player.getAddress())).equal(startTime + lockSeconds);

            //ExtendDays enum (0: 7days, 1: 30days, 2:90days)
            await votingEscrow.connect(player).extendLock(1); //7+30 days

            expect(await wasabi.balanceOf(votingEscrow.address)).equal(lockAmount);
            expect(await wasabi.balanceOf(await player.getAddress())).equal(mintAmount-lockAmount);
            expect(await votingEscrow.amountOf(await player.getAddress())).equal(lockAmount);
            expect(await votingEscrow.balanceOf(await player.getAddress())).equal(BigNumber.from(lockAmount).mul(37).div(1440));

            const newLockSeconds = 86400*37; //7+30
            expect(await votingEscrow.endOf(await player.getAddress())).equal(startTime + newLockSeconds);


          });
        });
      });

      context("add amount", () => {
        let mintAmount = 1000000;

        beforeEach(async () => {
          await wasabi.mint(await player.getAddress(), mintAmount);
          await wasabi.connect(player).approve(votingEscrow.address, MAXIMUM_U256);
        });

        it("cannot add amount when there's no existing lock", async () => {
          expect(votingEscrow.connect(player).addAmount(0)).revertedWith(
            "must locked"
          );
        });

        describe("with exsiting lock", () => {
          it("cannot add amount when expired", async () => {
            const lockAmount: number = 30000;
            //LockDays enum (0: 7days, 1: 30days, 2:90days)
            await votingEscrow.connect(player).createLock(lockAmount, 0);

            await increaseTime(ethers.provider, 86400*8);
            expect(votingEscrow.connect(player).addAmount(0)).revertedWith(
              "must not expired"
            );
          });

          it("cannot add zero amount", async () => {
            const lockAmount: number = 30000;
            //LockDays enum (0: 7days, 1: 30days, 2:90days)
            await votingEscrow.connect(player).createLock(lockAmount, 0);

            expect(votingEscrow.connect(player).addAmount(0)).revertedWith(
              "amount must be nonzero"
            );
          });

          it("can add amount", async () => {
            const lockAmount: number = 30000;
            const newLockAmount: number = 60000;

            //LockDays enum (0: 7days, 1: 30days, 2:90days)
            await votingEscrow.connect(player).createLock(lockAmount, 0);

            expect(await wasabi.balanceOf(votingEscrow.address)).equal(lockAmount);
            expect(await wasabi.balanceOf(await player.getAddress())).equal(mintAmount-lockAmount);
            expect(await votingEscrow.amountOf(await player.getAddress())).equal(lockAmount);
            expect(await votingEscrow.balanceOf(await player.getAddress())).equal(BigNumber.from(lockAmount).mul(7).div(1440));

            const lockSeconds = 86400*7; //7
            const startTime = Number(await votingEscrow.startOf(await player.getAddress()));
            expect(await votingEscrow.endOf(await player.getAddress())).equal(startTime + lockSeconds);

            await votingEscrow.connect(player).addAmount(newLockAmount); //30+30 days

            expect(await wasabi.balanceOf(votingEscrow.address)).equal(lockAmount+newLockAmount);
            expect(await wasabi.balanceOf(await player.getAddress())).equal(mintAmount-lockAmount-newLockAmount);
            expect(await votingEscrow.amountOf(await player.getAddress())).equal(lockAmount+newLockAmount);
            expect(await votingEscrow.endOf(await player.getAddress())).equal(startTime + lockSeconds);

            let balance = await votingEscrow.balanceOf(await player.getAddress());
            expect(balance).gte(BigNumber.from(lockAmount+newLockAmount).mul(7).div(1440).sub(EPSILON)).lte(BigNumber.from(lockAmount+newLockAmount).mul(7).div(1440));
          });
        });
      });

      context("withdraw", () => {
        let mintAmount = 1000000;

        beforeEach(async () => {
          await wasabi.mint(await player.getAddress(), mintAmount);
          await wasabi.connect(player).approve(votingEscrow.address, MAXIMUM_U256);
        });

        it("cannot withdraw when there's no existing lock", async () => {
          expect(votingEscrow.connect(player).withdraw()).revertedWith(
            "must locked"
          );
        });

        describe("with exsiting lock", () => {
          it("cannot withdraw within lock period", async () => {
            const lockAmount: number = 30000;
            //LockDays enum (0: 30days, 1: 60days, 2:90days)
            await votingEscrow.connect(player).createLock(lockAmount, 0);

            expect(votingEscrow.connect(player).withdraw()).revertedWith(
              "must expired"
            );
          });

          it("can withdraw", async () => {
            const lockAmount: number = 30000;

            //LockDays enum (0: 7days, 1: 30days, 2:90days)
            await votingEscrow.connect(player).createLock(lockAmount, 1);

            expect(await wasabi.balanceOf(votingEscrow.address)).equal(lockAmount);
            expect(await wasabi.balanceOf(await player.getAddress())).equal(mintAmount-lockAmount);
            expect(await votingEscrow.amountOf(await player.getAddress())).equal(lockAmount);
            expect(await votingEscrow.balanceOf(await player.getAddress())).equal(BigNumber.from(lockAmount).mul(30).div(1440));

            const lockSeconds = 86400*30; //30
            const startTime = Number(await votingEscrow.startOf(await player.getAddress()));
            expect(await votingEscrow.endOf(await player.getAddress())).equal(startTime + lockSeconds);


            await increaseTime(ethers.provider, 86400*31);

            await votingEscrow.connect(player).withdraw();

            expect(await wasabi.balanceOf(votingEscrow.address)).equal(0);
            expect(await wasabi.balanceOf(await player.getAddress())).equal(mintAmount);
            expect(await votingEscrow.amountOf(await player.getAddress())).equal(0);
            expect(await votingEscrow.balanceOf(await player.getAddress())).equal(0);
            expect(await votingEscrow.endOf(await player.getAddress())).equal(startTime + lockSeconds);
          });
        });
      });

      const shouldBehaveLikeSinglePersonLockWithoutVesting = (
        mintAmountReward1: number,
        mintAmountReward2: number
      ) => {
        let lockAmount = 30000;
        let mintAmount = 1000000;

        beforeEach(async () => {
          await wasabi.mint(await player.getAddress(), mintAmount);
          await wasabi.connect(player).approve(votingEscrowWithoutVesting.address, MAXIMUM_U256);

          //LockDays enum (0: 7days, 1: 30days, 2:90days, 3:180days,4:360days,5:1440days)
          await votingEscrowWithoutVesting.connect(player).createLock(lockAmount, 4);
          expect(await votingEscrowWithoutVesting.balanceOf(await player.getAddress())).equal(lockAmount*360/1440);
        });

        it("can see pending rewards", async () => {
          expect(await votingEscrowWithoutVesting.connect(player).pendingReward(await player.getAddress(),reward1.address)).gte(mintAmountReward1-EPSILON).lte(mintAmountReward1+EPSILON);
          expect(await votingEscrowWithoutVesting.connect(player).pendingReward(await player.getAddress(),reward2.address)).gte(mintAmountReward2-EPSILON).lte(mintAmountReward2+EPSILON);
        });

        it("can collect rewards from collector", async () => {
          expect(await reward1.balanceOf(await collector.getAddress())).equal(mintAmountReward1);
          expect(await reward1.balanceOf(votingEscrowWithoutVesting.address)).equal(0);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(mintAmountReward2);
          expect(await reward2.balanceOf(votingEscrowWithoutVesting.address)).equal(0);

          await votingEscrowWithoutVesting.collectReward();

          expect(await reward1.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward1.balanceOf(votingEscrowWithoutVesting.address)).equal(mintAmountReward1);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward2.balanceOf(votingEscrowWithoutVesting.address)).equal(mintAmountReward2);
        });

        it("can claim rewards directly without vesting", async () => {
          expect(await reward1.balanceOf(await collector.getAddress())).equal(mintAmountReward1);
          expect(await reward1.balanceOf(votingEscrowWithoutVesting.address)).equal(0);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(mintAmountReward2);
          expect(await reward2.balanceOf(votingEscrowWithoutVesting.address)).equal(0);

          await votingEscrowWithoutVesting.connect(player).vestEarning();

          expect(await reward1.balanceOf(await player.getAddress())).gte(mintAmountReward1-EPSILON).lte(mintAmountReward1+EPSILON);
          expect(await reward1.balanceOf(votingEscrowWithoutVesting.address)).lte(EPSILON);
          expect(await reward2.balanceOf(await player.getAddress())).gte(mintAmountReward2-EPSILON).lte(mintAmountReward2+EPSILON);
          expect(await reward2.balanceOf(votingEscrowWithoutVesting.address)).lte(EPSILON);
        });
      };

      const shouldBehaveLikeMultiplePeopleLocksWithoutVesting = (
        mintAmountReward1: number,
        mintAmountReward2: number
      ) => {
        let lockAmountForPlayer = 30000;
        let lockAmountForPlayer2 = 90000;
        let mintAmount = 1000000;
        let additionalMintAmountReward1 = 500000;

        beforeEach(async () => {
          await wasabi.mint(await player.getAddress(), mintAmount);
          await wasabi.connect(player).approve(votingEscrowWithoutVesting.address, MAXIMUM_U256);

          await wasabi.mint(await player2.getAddress(), mintAmount);
          await wasabi.connect(player2).approve(votingEscrowWithoutVesting.address, MAXIMUM_U256);

          expect(await reward1.balanceOf(await collector.getAddress())).equal(mintAmountReward1);
          expect(await reward1.balanceOf(votingEscrowWithoutVesting.address)).equal(0);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(mintAmountReward2);
          expect(await reward2.balanceOf(votingEscrowWithoutVesting.address)).equal(0);

          await votingEscrowWithoutVesting.connect(player).createLock(lockAmountForPlayer, 1);
          expect(await votingEscrowWithoutVesting.balanceOf(await player.getAddress())).equal(BigNumber.from(lockAmountForPlayer).mul(30).div(1440));

          expect(await reward1.balanceOf(await collector.getAddress())).equal(mintAmountReward1);
          expect(await reward1.balanceOf(votingEscrowWithoutVesting.address)).equal(0);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(mintAmountReward2);
          expect(await reward2.balanceOf(votingEscrowWithoutVesting.address)).equal(0);

          await votingEscrowWithoutVesting.connect(player2).createLock(lockAmountForPlayer2, 1);
          expect(await votingEscrowWithoutVesting.balanceOf(await player2.getAddress())).equal(BigNumber.from(lockAmountForPlayer2).mul(30).div(1440));

          expect(await reward1.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward1.balanceOf(votingEscrowWithoutVesting.address)).equal(mintAmountReward1);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward2.balanceOf(votingEscrowWithoutVesting.address)).equal(mintAmountReward2);

          await reward1.mint(await collector.getAddress(), additionalMintAmountReward1);
          await reward1.connect(collector).approve(votingEscrowWithoutVesting.address, MAXIMUM_U256);
        });

        it("player can see pending rewards", async () => {
          expect(await votingEscrowWithoutVesting.connect(player).pendingReward(await player.getAddress(),reward1.address))
            .equal(mintAmountReward1 + additionalMintAmountReward1*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2));
          expect(await votingEscrowWithoutVesting.connect(player).pendingReward(await player.getAddress(),reward2.address))
            .equal(mintAmountReward2);
        });

        it("player2 can see pending rewards", async () => {
          expect(await votingEscrowWithoutVesting.connect(player2).pendingReward(await player2.getAddress(),reward1.address))
            .equal(additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2));
          expect(await votingEscrowWithoutVesting.connect(player2).pendingReward(await player2.getAddress(),reward2.address))
            .equal(0);
        });

        it("player can collect rewards", async () => {
          expect(await reward1.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward1);
          expect(await reward1.balanceOf(votingEscrowWithoutVesting.address)).equal(mintAmountReward1);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward2.balanceOf(votingEscrowWithoutVesting.address)).equal(mintAmountReward2);

          await votingEscrowWithoutVesting.connect(player).collectReward();

          expect(await reward1.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward1.balanceOf(votingEscrowWithoutVesting.address)).equal(mintAmountReward1+additionalMintAmountReward1);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward2.balanceOf(votingEscrowWithoutVesting.address)).equal(mintAmountReward2);
        });

        it("player2 can collect rewards", async () => {
          expect(await reward1.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward1);
          expect(await reward1.balanceOf(votingEscrowWithoutVesting.address)).equal(mintAmountReward1);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward2.balanceOf(votingEscrowWithoutVesting.address)).equal(mintAmountReward2);

          await votingEscrowWithoutVesting.connect(player2).collectReward();

          expect(await reward1.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward1.balanceOf(votingEscrowWithoutVesting.address)).equal(mintAmountReward1+additionalMintAmountReward1);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward2.balanceOf(votingEscrowWithoutVesting.address)).equal(mintAmountReward2);
        });

        it("player can claim rewards directly without vesting", async () => {
          expect(await reward1.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward1);
          expect(await reward1.balanceOf(votingEscrowWithoutVesting.address)).equal(mintAmountReward1);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward2.balanceOf(votingEscrowWithoutVesting.address)).equal(mintAmountReward2);

          await votingEscrowWithoutVesting.connect(player).vestEarning();

          expect(await reward1.balanceOf(await player.getAddress())).equal(mintAmountReward1+additionalMintAmountReward1*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2));
          expect(await reward1.balanceOf(votingEscrowWithoutVesting.address)).equal(additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2));
          expect(await reward2.balanceOf(await player.getAddress())).equal(mintAmountReward2);
          expect(await reward2.balanceOf(votingEscrowWithoutVesting.address)).equal(0);
        });

        it("player2 can claim rewards directly without vesting", async () => {
          expect(await reward1.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward1);
          expect(await reward1.balanceOf(votingEscrowWithoutVesting.address)).equal(mintAmountReward1);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward2.balanceOf(votingEscrowWithoutVesting.address)).equal(mintAmountReward2);

          await votingEscrowWithoutVesting.connect(player2).vestEarning();

          expect(await reward1.balanceOf(await player2.getAddress())).equal(additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2));
          expect(await reward1.balanceOf(votingEscrowWithoutVesting.address)).equal(mintAmountReward1+additionalMintAmountReward1*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2));
          expect(await reward2.balanceOf(await player2.getAddress())).equal(0);
          expect(await reward2.balanceOf(votingEscrowWithoutVesting.address)).equal(mintAmountReward2);
        });
      };

      const shouldBehaveLikeSinglePersonLockWithVesting = (
        mintAmountReward1: number,
        mintAmountReward2: number
      ) => {
        let lockAmount = 30000;
        let mintAmount = 1000000;

        beforeEach(async () => {
          await wasabi.mint(await player.getAddress(), mintAmount);
          await wasabi.connect(player).approve(votingEscrow.address, MAXIMUM_U256);

          await votingEscrow.connect(player).createLock(lockAmount, 1);
          expect(await votingEscrow.balanceOf(await player.getAddress())).equal(BigNumber.from(lockAmount).mul(30).div(1440));
        });

        it("can see pending rewards", async () => {
          expect(await votingEscrow.connect(player).pendingReward(await player.getAddress(),reward1.address)).equal(mintAmountReward1);
          expect(await votingEscrow.connect(player).pendingReward(await player.getAddress(),reward2.address)).equal(mintAmountReward2);
        });

        it("can collect rewards from collector", async () => {
          expect(await reward1.balanceOf(await collector.getAddress())).equal(mintAmountReward1);
          expect(await reward1.balanceOf(votingEscrow.address)).equal(0);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(mintAmountReward2);
          expect(await reward2.balanceOf(votingEscrow.address)).equal(0);

          await votingEscrow.collectReward();

          expect(await reward1.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward1.balanceOf(votingEscrow.address)).equal(mintAmountReward1);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward2.balanceOf(votingEscrow.address)).equal(mintAmountReward2);
        });

        it("can claim rewards to the reward vesting contract", async () => {
          expect(await reward1.balanceOf(await collector.getAddress())).equal(mintAmountReward1);
          expect(await reward1.balanceOf(votingEscrow.address)).equal(0);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(mintAmountReward2);
          expect(await reward2.balanceOf(votingEscrow.address)).equal(0);

          await votingEscrow.connect(player).vestEarning();

          expect(await reward1.balanceOf(await player.getAddress())).equal(0);
          expect(await reward1.balanceOf(rewardVesting1.address)).equal(mintAmountReward1);
          expect(await reward1.balanceOf(votingEscrow.address)).equal(0);
          expect(await reward2.balanceOf(await player.getAddress())).equal(0);
          expect(await reward2.balanceOf(rewardVesting2.address)).equal(mintAmountReward2);
          expect(await reward2.balanceOf(votingEscrow.address)).equal(0);
        });
      };

      const shouldBehaveLikeMultiplePeopleLocksWithVesting = (
        mintAmountReward1: number,
        mintAmountReward2: number
      ) => {
        let lockAmountForPlayer = 30000;
        let lockAmountForPlayer2 = 90000;
        let mintAmount = 1000000;
        let additionalMintAmountReward1 = 500000;

        beforeEach(async () => {
          await wasabi.mint(await player.getAddress(), mintAmount);
          await wasabi.connect(player).approve(votingEscrow.address, MAXIMUM_U256);

          await wasabi.mint(await player2.getAddress(), mintAmount);
          await wasabi.connect(player2).approve(votingEscrow.address, MAXIMUM_U256);

          expect(await reward1.balanceOf(await collector.getAddress())).equal(mintAmountReward1);
          expect(await reward1.balanceOf(votingEscrow.address)).equal(0);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(mintAmountReward2);
          expect(await reward2.balanceOf(votingEscrow.address)).equal(0);

          //LockDays enum (0: 7days, 1: 30days, 2:90days, 3:180days,4:360days,5:1440days)
          await votingEscrow.connect(player).createLock(lockAmountForPlayer, 4);
          expect(await votingEscrow.balanceOf(await player.getAddress())).equal(lockAmountForPlayer*360/1440);

          expect(await reward1.balanceOf(await collector.getAddress())).equal(mintAmountReward1);
          expect(await reward1.balanceOf(votingEscrow.address)).equal(0);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(mintAmountReward2);
          expect(await reward2.balanceOf(votingEscrow.address)).equal(0);

          await votingEscrow.connect(player2).createLock(lockAmountForPlayer2, 4);
          expect(await votingEscrow.balanceOf(await player2.getAddress())).equal(lockAmountForPlayer2*360/1440);

          expect(await reward1.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward1.balanceOf(votingEscrow.address)).equal(mintAmountReward1);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward2.balanceOf(votingEscrow.address)).equal(mintAmountReward2);

          await reward1.mint(await collector.getAddress(), additionalMintAmountReward1);
          await reward1.connect(collector).approve(votingEscrow.address, MAXIMUM_U256);
        });

        it("player can see pending rewards", async () => {
          expect(await votingEscrow.connect(player).pendingReward(await player.getAddress(),reward1.address))
            .gte(mintAmountReward1 + additionalMintAmountReward1*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2) - EPSILON).lte(mintAmountReward1 + additionalMintAmountReward1*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2) + EPSILON);
          expect(await votingEscrow.connect(player).pendingReward(await player.getAddress(),reward2.address))
            .equal(mintAmountReward2);
        });

        it("player2 can see pending rewards", async () => {
          expect(await votingEscrow.connect(player2).pendingReward(await player2.getAddress(),reward1.address))
            .equal(additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2));
          expect(await votingEscrow.connect(player2).pendingReward(await player2.getAddress(),reward2.address))
          .equal(0);

        });

        it("player can collect rewards", async () => {
          expect(await reward1.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward1);
          expect(await reward1.balanceOf(votingEscrow.address)).equal(mintAmountReward1);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward2.balanceOf(votingEscrow.address)).equal(mintAmountReward2);

          await votingEscrow.connect(player).collectReward();

          expect(await reward1.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward1.balanceOf(votingEscrow.address)).equal(mintAmountReward1+additionalMintAmountReward1);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward2.balanceOf(votingEscrow.address)).equal(mintAmountReward2);
        });

        it("player2 can collect rewards", async () => {
          expect(await reward1.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward1);
          expect(await reward1.balanceOf(votingEscrow.address)).equal(mintAmountReward1);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward2.balanceOf(votingEscrow.address)).equal(mintAmountReward2);

          await votingEscrow.connect(player2).collectReward();

          expect(await reward1.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward1.balanceOf(votingEscrow.address)).equal(mintAmountReward1+additionalMintAmountReward1);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward2.balanceOf(votingEscrow.address)).equal(mintAmountReward2);
        });

        it("player can claim rewards to the reward vesting contract", async () => {
          expect(await reward1.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward1);
          expect(await reward1.balanceOf(votingEscrow.address)).equal(mintAmountReward1);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward2.balanceOf(votingEscrow.address)).equal(mintAmountReward2);

          await votingEscrow.connect(player).vestEarning();

          expect(await reward1.balanceOf(await player.getAddress())).equal(0);
          expect(await reward1.balanceOf(rewardVesting1.address)).gte(mintAmountReward1+additionalMintAmountReward1*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2) - EPSILON).lte(mintAmountReward1+additionalMintAmountReward1*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2) + EPSILON);
          expect(await reward1.balanceOf(votingEscrow.address)).gte(additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2) - EPSILON).lte(additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2) + EPSILON);
          expect(await reward2.balanceOf(await player.getAddress())).equal(0);
          expect(await reward2.balanceOf(rewardVesting2.address)).equal(mintAmountReward2);
          expect(await reward2.balanceOf(votingEscrow.address)).equal(0);
        });

        it("player2 can claim rewards to the reward vesting contract", async () => {
          expect(await reward1.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward1);
          expect(await reward1.balanceOf(votingEscrow.address)).equal(mintAmountReward1);
          expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
          expect(await reward2.balanceOf(votingEscrow.address)).equal(mintAmountReward2);

          await votingEscrow.connect(player2).vestEarning();

          expect(await reward1.balanceOf(await player2.getAddress())).equal(0);
          expect(await reward1.balanceOf(rewardVesting1.address)).equal(additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2));
          expect(await reward1.balanceOf(votingEscrow.address)).equal(mintAmountReward1+additionalMintAmountReward1*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2));
          expect(await reward2.balanceOf(await player2.getAddress())).equal(0);
          expect(await reward2.balanceOf(rewardVesting2.address)).equal(0);
          expect(await reward2.balanceOf(votingEscrow.address)).equal(mintAmountReward2);
        });
      };

      context("single reward from collector", () => {
        describe("without vesting", () => {
          let mintAmount = 1000000;

          beforeEach(async () => {
            await reward1.mint(await collector.getAddress(), mintAmount);
            await reward1.connect(collector).approve(votingEscrowWithoutVesting.address, MAXIMUM_U256);
          });

          it("nothing happened in collect rewards when nobody's locked", async () => {
            await votingEscrowWithoutVesting.collectReward();
            expect(await wasabi.balanceOf(votingEscrowWithoutVesting.address)).equal(0);
            expect(await reward1.balanceOf(votingEscrowWithoutVesting.address)).equal(0);
          });

          it("can see pending rewards as 0 when no lock", async () => {
            expect(await votingEscrowWithoutVesting.connect(player).pendingReward(await player.getAddress(),reward1.address)).equal(0);
            expect(await votingEscrowWithoutVesting.connect(player).pendingReward(await player.getAddress(),reward2.address)).equal(0);
          });

          describe("single person lock", () => {
            shouldBehaveLikeSinglePersonLockWithoutVesting(mintAmount, 0);
          });

          describe("multiple people locks", () => {
            shouldBehaveLikeMultiplePeopleLocksWithoutVesting(mintAmount, 0);
          });
        });

        describe("with vesting", () => {
          let mintAmount = 1000000;

          beforeEach(async () => {
            await reward1.mint(await collector.getAddress(), mintAmount);
            await reward1.connect(collector).approve(votingEscrow.address, MAXIMUM_U256);
          });

          it("nothing happened in collect rewards when nobody's locked", async () => {
            await votingEscrow.collectReward();
            expect(await wasabi.balanceOf(votingEscrow.address)).equal(0);
            expect(await reward1.balanceOf(votingEscrow.address)).equal(0);
          });

          it("can see pending rewards as 0 when no lock", async () => {
            expect(await votingEscrow.connect(player).pendingReward(await player.getAddress(),reward1.address)).equal(0);
            expect(await votingEscrow.connect(player).pendingReward(await player.getAddress(),reward2.address)).equal(0);
          });

          describe("single person lock", () => {
            shouldBehaveLikeSinglePersonLockWithVesting(mintAmount, 0);
          });

          describe("multiple people locks", () => {
            shouldBehaveLikeMultiplePeopleLocksWithVesting(mintAmount, 0);
          });
        });
      });

      context("multiple rewards from collector", () => {
        describe("all tokens without vesting", () => {
          let mintAmountReward1 = 1000000;
          let mintAmountReward2 = 3000000;

          beforeEach(async () => {
            await reward1.mint(await collector.getAddress(), mintAmountReward1);
            await reward1.connect(collector).approve(votingEscrowWithoutVesting.address, MAXIMUM_U256);
            await reward2.mint(await collector.getAddress(), mintAmountReward2);
            await reward2.connect(collector).approve(votingEscrowWithoutVesting.address, MAXIMUM_U256);
          });

          it("nothing happened in collect rewards when nobody's locked", async () => {
            await votingEscrowWithoutVesting.collectReward();
            expect(await wasabi.balanceOf(votingEscrowWithoutVesting.address)).equal(0);
            expect(await reward1.balanceOf(votingEscrowWithoutVesting.address)).equal(0);
            expect(await reward2.balanceOf(votingEscrowWithoutVesting.address)).equal(0);
          });

          it("can see pending rewards as 0 when no lock", async () => {
            expect(await votingEscrowWithoutVesting.connect(player).pendingReward(await player.getAddress(),reward1.address)).equal(0);
            expect(await votingEscrowWithoutVesting.connect(player).pendingReward(await player.getAddress(),reward2.address)).equal(0);
          });

          describe("single person lock", () => {
            shouldBehaveLikeSinglePersonLockWithoutVesting(mintAmountReward1, mintAmountReward2);
          });

          describe("multiple people locks", () => {
            shouldBehaveLikeMultiplePeopleLocksWithoutVesting(mintAmountReward1, mintAmountReward2);
          });
        });

        describe("all tokens with vesting", () => {
          let mintAmountReward1 = 1000000;
          let mintAmountReward2 = 3000000;

          beforeEach(async () => {
            await reward1.mint(await collector.getAddress(), mintAmountReward1);
            await reward1.connect(collector).approve(votingEscrow.address, MAXIMUM_U256);
            await reward2.mint(await collector.getAddress(), mintAmountReward2);
            await reward2.connect(collector).approve(votingEscrow.address, MAXIMUM_U256);
          });

          it("nothing happened in collect rewards when nobody's locked", async () => {
            await votingEscrow.collectReward();
            expect(await wasabi.balanceOf(votingEscrow.address)).equal(0);
            expect(await reward1.balanceOf(votingEscrow.address)).equal(0);
            expect(await reward2.balanceOf(votingEscrow.address)).equal(0);
          });

          it("can see pending rewards as 0 when no lock", async () => {
            expect(await votingEscrow.connect(player).pendingReward(await player.getAddress(),reward1.address)).equal(0);
            expect(await votingEscrow.connect(player).pendingReward(await player.getAddress(),reward2.address)).equal(0);
          });

          describe("single person lock", () => {
            shouldBehaveLikeSinglePersonLockWithVesting(mintAmountReward1, mintAmountReward2);
          });

          describe("multiple people locks", () => {
            shouldBehaveLikeMultiplePeopleLocksWithVesting(mintAmountReward1, mintAmountReward2);
          });
        });

        describe("one token with vesting and one without", () => {
          let mintAmountReward1 = 1000000;
          let mintAmountReward2 = 3000000;
          let newVotingEscrow;

          beforeEach(async () => {
            newVotingEscrow = (await VotingEscrowFactory.connect(deployer).deploy(await governance.getAddress())) as VotingEscrow;
            // reward1 with vesting, reward2 without vesting
            await newVotingEscrow.connect(governance).initialize(wasabi.address,0,true,wasabiRewardVesting.address,[reward1.address, reward2.address],[rewardVesting1.address, rewardVesting2.address], [true, false], await collector.getAddress());

            await reward1.mint(await collector.getAddress(), mintAmountReward1);
            await reward1.connect(collector).approve(newVotingEscrow.address, MAXIMUM_U256);
            await reward2.mint(await collector.getAddress(), mintAmountReward2);
            await reward2.connect(collector).approve(newVotingEscrow.address, MAXIMUM_U256);
          });

          it("nothing happened in collect rewards when nobody's locked", async () => {
            await newVotingEscrow.collectReward();
            expect(await wasabi.balanceOf(newVotingEscrow.address)).equal(0);
            expect(await reward1.balanceOf(newVotingEscrow.address)).equal(0);
            expect(await reward2.balanceOf(newVotingEscrow.address)).equal(0);
          });

          it("can see pending rewards as 0 when no lock", async () => {
            expect(await newVotingEscrow.connect(player).pendingReward(await player.getAddress(),reward1.address)).equal(0);
            expect(await newVotingEscrow.connect(player).pendingReward(await player.getAddress(),reward2.address)).equal(0);
          });

          describe("single person lock", () => {
            let lockAmount = 30000;
            let mintAmount = 1000000;

            beforeEach(async () => {
              await wasabi.mint(await player.getAddress(), mintAmount);
              await wasabi.connect(player).approve(newVotingEscrow.address, MAXIMUM_U256);

              //LockDays enum (0: 7days, 1: 30days, 2:90days, 3:180days,4:360days,5:1440days)
              await newVotingEscrow.connect(player).createLock(lockAmount, 4);
              expect(await newVotingEscrow.balanceOf(await player.getAddress())).equal(lockAmount*360/1440);
            });

            it("can see pending rewards", async () => {
              expect(await newVotingEscrow.connect(player).pendingReward(await player.getAddress(),reward1.address)).gte(mintAmountReward1 - EPSILON).lte(mintAmountReward1 + EPSILON);
              expect(await newVotingEscrow.connect(player).pendingReward(await player.getAddress(),reward2.address)).gte(mintAmountReward2 - EPSILON).lte(mintAmountReward2 + EPSILON);
            });

            it("can collect rewards from collector", async () => {
              expect(await reward1.balanceOf(await collector.getAddress())).equal(mintAmountReward1);
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(0);
              expect(await reward2.balanceOf(await collector.getAddress())).equal(mintAmountReward2);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(0);

              await newVotingEscrow.collectReward();

              expect(await reward1.balanceOf(await collector.getAddress())).equal(0);
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(mintAmountReward1);
              expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(mintAmountReward2);
            });

            it("can claim rewards with correct vesting state", async () => {
              expect(await reward1.balanceOf(await collector.getAddress())).equal(mintAmountReward1);
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(0);
              expect(await reward2.balanceOf(await collector.getAddress())).equal(mintAmountReward2);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(0);

              await newVotingEscrow.connect(player).vestEarning();

              // reward1 with vesting
              expect(await reward1.balanceOf(await player.getAddress())).equal(0);
              expect(await reward1.balanceOf(rewardVesting1.address)).gte(mintAmountReward1 - EPSILON).lte(mintAmountReward1 + EPSILON);
              expect(await reward1.balanceOf(newVotingEscrow.address)).lte(EPSILON);
              // reward2 without vesting
              expect(await reward2.balanceOf(await player.getAddress())).gte(mintAmountReward2 - EPSILON).lte(mintAmountReward2 + EPSILON);
              expect(await reward2.balanceOf(rewardVesting2.address)).equal(0);
              expect(await reward2.balanceOf(newVotingEscrow.address)).lte(EPSILON);
            });
          });

          describe("multiple people lock", () => {
            let lockAmountForPlayer = 30000;
            let lockAmountForPlayer2 = 90000;
            let mintAmount = 1000000;

            let additionalMintAmountReward1 = 500000;
            let additionalMintAmountReward2 = 1500000;

            beforeEach(async () => {
              await wasabi.mint(await player.getAddress(), mintAmount);
              await wasabi.connect(player).approve(newVotingEscrow.address, MAXIMUM_U256);

              await wasabi.mint(await player2.getAddress(), mintAmount);
              await wasabi.connect(player2).approve(newVotingEscrow.address, MAXIMUM_U256);

              //LockDays enum (0: 7days, 1: 30days, 2:90days, 3:180days,4:360days,5:1440days)
              await newVotingEscrow.connect(player).createLock(lockAmountForPlayer, 3);
              expect(await newVotingEscrow.balanceOf(await player.getAddress())).equal(lockAmountForPlayer*180/1440);

              await newVotingEscrow.connect(player2).createLock(lockAmountForPlayer2, 3);
              expect(await newVotingEscrow.balanceOf(await player2.getAddress())).equal(lockAmountForPlayer2*180/1440);

              await reward1.mint(await collector.getAddress(), additionalMintAmountReward1);
              await reward1.connect(collector).approve(newVotingEscrow.address, MAXIMUM_U256);
              await reward2.mint(await collector.getAddress(), additionalMintAmountReward2);
              await reward2.connect(collector).approve(newVotingEscrow.address, MAXIMUM_U256);
            });

            it("player can see pending rewards", async () => {
              expect(await newVotingEscrow.connect(player).pendingReward(await player.getAddress(),reward1.address))
                .gte(mintAmountReward1+additionalMintAmountReward1*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2) - EPSILON).lte(mintAmountReward1+additionalMintAmountReward1*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2) + EPSILON);
              expect(await newVotingEscrow.connect(player).pendingReward(await player.getAddress(),reward2.address))
                .equal(mintAmountReward2+additionalMintAmountReward2*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2));
            });

            it("player2 can see pending rewards", async () => {
              expect(await newVotingEscrow.connect(player2).pendingReward(await player2.getAddress(),reward1.address))
                .equal(additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2));
              expect(await newVotingEscrow.connect(player2).pendingReward(await player2.getAddress(),reward2.address))
                .equal(additionalMintAmountReward2*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2));
            });

            it("player can collect rewards", async () => {
              expect(await reward1.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward1);
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(mintAmountReward1);
              expect(await reward2.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward2);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(mintAmountReward2);

              await newVotingEscrow.connect(player).collectReward();

              expect(await reward1.balanceOf(await collector.getAddress())).equal(0);
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(mintAmountReward1+additionalMintAmountReward1);
              expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(mintAmountReward2+additionalMintAmountReward2);
            });

            it("player2 can collect rewards", async () => {
              expect(await reward1.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward1);
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(mintAmountReward1);
              expect(await reward2.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward2);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(mintAmountReward2);

              await newVotingEscrow.connect(player2).collectReward();

              expect(await reward1.balanceOf(await collector.getAddress())).equal(0);
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(mintAmountReward1+additionalMintAmountReward1);
              expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(mintAmountReward2+additionalMintAmountReward2);
            });

            it("player can claim rewards with correct vesting state", async () => {
              expect(await reward1.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward1);
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(mintAmountReward1);
              expect(await reward2.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward2);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(mintAmountReward2);

              await newVotingEscrow.connect(player).vestEarning();

              // reward1 with vesting
              expect(await reward1.balanceOf(await player.getAddress())).equal(0);
              expect(await reward1.balanceOf(rewardVesting1.address)).gte(mintAmountReward1+additionalMintAmountReward1*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2) - EPSILON).lte(mintAmountReward1+additionalMintAmountReward1*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2) + EPSILON);
              expect(await reward1.balanceOf(newVotingEscrow.address)).gte(additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2) - EPSILON).lte(additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2) + EPSILON);
              // reward2 without vesting
              expect(await reward2.balanceOf(await player.getAddress())).equal(mintAmountReward2+additionalMintAmountReward2*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2));
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(additionalMintAmountReward2*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2));
            });

            it("player2 can claim rewards with correct vesting state", async () => {
              expect(await reward1.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward1);
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(mintAmountReward1);
              expect(await reward2.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward2);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(mintAmountReward2);

              await newVotingEscrow.connect(player2).vestEarning();

              // reward1 with vesting
              expect(await reward1.balanceOf(await player2.getAddress())).equal(0);
              expect(await reward1.balanceOf(rewardVesting1.address)).equal(additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2));
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(mintAmountReward1+additionalMintAmountReward1*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2));
              // reward2 without vesting
              expect(await reward2.balanceOf(await player2.getAddress())).equal(additionalMintAmountReward2*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2));
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(mintAmountReward2+additionalMintAmountReward2*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2));

            });
          });
        });
      });

      context("wasabi minting reward + other rewards from collector", () => {

        describe("one token with vesting and one without", () => {
          let mintAmountReward1 = 1000000;
          let mintAmountReward2 = 3000000;
          let newVotingEscrow;
          let wasabiRewardRate = 100;

          beforeEach(async () => {
            newVotingEscrow = (await VotingEscrowFactory.connect(deployer).deploy(await governance.getAddress())) as VotingEscrow;
            // wasabi reward rate 10 per block, reward1 with vesting, reward2 without vesting
            await newVotingEscrow.connect(governance)
              .initialize(wasabi.address,wasabiRewardRate,true,wasabiRewardVesting.address,
                          [reward1.address, reward2.address],[rewardVesting1.address, rewardVesting2.address], [true, false],
                          await collector.getAddress());

            await reward1.mint(await collector.getAddress(), mintAmountReward1);
            await reward1.connect(collector).approve(newVotingEscrow.address, MAXIMUM_U256);
            await reward2.mint(await collector.getAddress(), mintAmountReward2);
            await reward2.connect(collector).approve(newVotingEscrow.address, MAXIMUM_U256);
          });

          it("nothing happened in collect rewards when nobody's locked", async () => {
            await newVotingEscrow.collectReward();
            expect(await wasabi.balanceOf(newVotingEscrow.address)).equal(0);
            expect(await reward1.balanceOf(newVotingEscrow.address)).equal(0);
            expect(await reward2.balanceOf(newVotingEscrow.address)).equal(0);
          });

          it("can see pending rewards as 0 when no lock", async () => {
            expect(await newVotingEscrow.connect(player).pendingWasabi(await player.getAddress())).equal(0);
            expect(await newVotingEscrow.connect(player).pendingReward(await player.getAddress(),reward1.address)).equal(0);
            expect(await newVotingEscrow.connect(player).pendingReward(await player.getAddress(),reward2.address)).equal(0);
          });

          describe("single person lock", () => {
            let lockAmount = 30000;
            let mintAmount = 1000000;
            let elapsedBlocks = 1000;

            beforeEach(async () => {
              await wasabi.mint(await player.getAddress(), mintAmount);
              await wasabi.connect(player).approve(newVotingEscrow.address, MAXIMUM_U256);
            });

            it("can see pending rewards", async () => {
              //LockDays enum (0: 7days, 1: 30days, 2:90days, 3:180days,4:360days,5:1440days)
              await newVotingEscrow.connect(player).createLock(lockAmount, 2);
              expect(await newVotingEscrow.balanceOf(await player.getAddress())).equal(lockAmount*90/1440);
              await mineBlocks(ethers.provider, elapsedBlocks);

              const wasabiRewardAmount = wasabiRewardRate * (elapsedBlocks);
              expect(await newVotingEscrow.connect(player).pendingWasabi(await player.getAddress())).gte(wasabiRewardAmount - EPSILON).lte(wasabiRewardAmount + EPSILON);
              expect(await newVotingEscrow.connect(player).pendingReward(await player.getAddress(),reward1.address)).gte(mintAmountReward1 - EPSILON).lte(mintAmountReward1 + EPSILON);
              expect(await newVotingEscrow.connect(player).pendingReward(await player.getAddress(),reward2.address)).gte(mintAmountReward2 - EPSILON).lte(mintAmountReward2 + EPSILON);
            });

            it("can collect rewards from collector", async () => {
              await newVotingEscrow.connect(player).createLock(lockAmount, 2);
              expect(await newVotingEscrow.balanceOf(await player.getAddress())).equal(lockAmount*90/1440);
              await mineBlocks(ethers.provider, elapsedBlocks);

              expect(await reward1.balanceOf(await collector.getAddress())).equal(mintAmountReward1);
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(0);
              expect(await reward2.balanceOf(await collector.getAddress())).equal(mintAmountReward2);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(0);

              await newVotingEscrow.collectReward();

              const wasabiRewardAmount = wasabiRewardRate * (elapsedBlocks+1);
              expect(await wasabi.balanceOf(newVotingEscrow.address)).equal(wasabiRewardAmount+lockAmount);
              expect(await reward1.balanceOf(await collector.getAddress())).equal(0);
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(mintAmountReward1);
              expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(mintAmountReward2);
            });

            it("can claim rewards with correct vesting state", async () => {
              await newVotingEscrow.connect(player).createLock(lockAmount, 2);
              expect(await newVotingEscrow.balanceOf(await player.getAddress())).equal(lockAmount*90/1440);
              await mineBlocks(ethers.provider, elapsedBlocks);

              expect(await wasabi.balanceOf(await player.getAddress())).equal(mintAmount-lockAmount);
              expect(await reward1.balanceOf(await collector.getAddress())).equal(mintAmountReward1);
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(0);
              expect(await reward2.balanceOf(await collector.getAddress())).equal(mintAmountReward2);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(0);

              await newVotingEscrow.connect(player).vestEarning();

              // wasabi with vesting
              const wasabiRewardAmount = wasabiRewardRate * (elapsedBlocks+1);
              expect(await wasabi.balanceOf(await player.getAddress())).equal(mintAmount-lockAmount);
              expect(await wasabi.balanceOf(wasabiRewardVesting.address)).gte(wasabiRewardAmount - EPSILON).lte(wasabiRewardAmount + EPSILON);
              expect(await wasabi.balanceOf(newVotingEscrow.address)).gte(lockAmount-EPSILON).lte(lockAmount+EPSILON);
              // reward1 with vesting
              expect(await reward1.balanceOf(await player.getAddress())).equal(0);
              expect(await reward1.balanceOf(rewardVesting1.address)).gte(mintAmountReward1 - EPSILON).lte(mintAmountReward1 + EPSILON);
              expect(await reward1.balanceOf(newVotingEscrow.address)).lte(EPSILON);
              // reward2 without vesting
              expect(await reward2.balanceOf(await player.getAddress())).equal(mintAmountReward2);
              expect(await reward2.balanceOf(rewardVesting2.address)).equal(0);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(0);
            });
          });

          describe("multiple people lock", () => {
            let lockAmountForPlayer = 30000;
            let lockAmountForPlayer2 = 90000;
            let mintAmount = 1000000;
            let additionalMintAmountReward1 = 50000;
            let elapsedBlocksForPlayer;
            let elapsedBlocksForPlayer2;

            beforeEach(async () => {
              elapsedBlocksForPlayer = 0;
              elapsedBlocksForPlayer2 = 0;

              await wasabi.mint(await player.getAddress(), mintAmount);
              await wasabi.connect(player).approve(newVotingEscrow.address, MAXIMUM_U256);

              await wasabi.mint(await player2.getAddress(), mintAmount);
              await wasabi.connect(player2).approve(newVotingEscrow.address, MAXIMUM_U256);

              //LockDays enum (0: 7days, 1: 30days, 2:90days, 3:180days,4:360days,5:1440days)
              await newVotingEscrow.connect(player).createLock(lockAmountForPlayer, 3);
              expect(await newVotingEscrow.balanceOf(await player.getAddress())).equal(lockAmountForPlayer*180/1440);

              await mineBlocks(ethers.provider, 10);
              elapsedBlocksForPlayer += 10;

              await newVotingEscrow.connect(player2).createLock(lockAmountForPlayer2, 3);
              elapsedBlocksForPlayer += 1;
              expect(await newVotingEscrow.balanceOf(await player2.getAddress())).equal(lockAmountForPlayer2*180/1440);

              await mineBlocks(ethers.provider, 10);
              elapsedBlocksForPlayer += 10;
              elapsedBlocksForPlayer2 += 10;

              await reward1.mint(await collector.getAddress(), additionalMintAmountReward1);
              elapsedBlocksForPlayer += 1;
              elapsedBlocksForPlayer2 += 1;
              await reward1.connect(collector).approve(newVotingEscrow.address, MAXIMUM_U256);
              elapsedBlocksForPlayer += 1;
              elapsedBlocksForPlayer2 += 1;
            });

            it("player can see pending rewards", async () => {
              const wasabiRewardAmount = wasabiRewardRate * (elapsedBlocksForPlayer-elapsedBlocksForPlayer2) + wasabiRewardRate * elapsedBlocksForPlayer2 * lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2);
              expect(await newVotingEscrow.connect(player).pendingWasabi(await player.getAddress())).gte(wasabiRewardAmount - EPSILON).lte(wasabiRewardAmount + EPSILON);
              expect(await newVotingEscrow.connect(player).pendingReward(await player.getAddress(),reward1.address))
                .gte(mintAmountReward1+additionalMintAmountReward1*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2) - EPSILON).lte(mintAmountReward1+additionalMintAmountReward1*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2) + EPSILON);
              expect(await newVotingEscrow.connect(player).pendingReward(await player.getAddress(),reward2.address))
                .equal(mintAmountReward2);
            });

            it("player2 can see pending rewards", async () => {
              const wasabiRewardAmount = wasabiRewardRate * elapsedBlocksForPlayer2 * lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2);
              expect(await newVotingEscrow.connect(player2).pendingWasabi(await player2.getAddress())).equal(wasabiRewardAmount);
              expect(await newVotingEscrow.connect(player2).pendingReward(await player2.getAddress(),reward1.address))
                .equal(additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2));
              expect(await newVotingEscrow.connect(player2).pendingReward(await player2.getAddress(),reward2.address))
                .equal(0);
            });

            it("player can collect rewards", async () => {
              expect(await reward1.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward1);
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(mintAmountReward1);
              expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(mintAmountReward2);

              await newVotingEscrow.connect(player).collectReward();
              elapsedBlocksForPlayer += 1;

              const wasabiRewardAmount = wasabiRewardRate * (elapsedBlocksForPlayer);
              expect(await wasabi.balanceOf(newVotingEscrow.address)).equal(wasabiRewardAmount+lockAmountForPlayer+lockAmountForPlayer2);
              expect(await reward1.balanceOf(await collector.getAddress())).equal(0);
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(mintAmountReward1+additionalMintAmountReward1);
              expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(mintAmountReward2);
            });

            it("player2 can collect rewards", async () => {
              expect(await reward1.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward1);
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(mintAmountReward1);
              expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(mintAmountReward2);

              await newVotingEscrow.connect(player2).collectReward();
              elapsedBlocksForPlayer += 1;

              const wasabiRewardAmount = wasabiRewardRate * (elapsedBlocksForPlayer);
              expect(await wasabi.balanceOf(newVotingEscrow.address)).equal(wasabiRewardAmount+lockAmountForPlayer+lockAmountForPlayer2);
              expect(await reward1.balanceOf(await collector.getAddress())).equal(0);
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(mintAmountReward1+additionalMintAmountReward1);
              expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(mintAmountReward2);
            });

            it("player can claim rewards with correct vesting state", async () => {
              expect(await reward1.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward1);
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(mintAmountReward1);
              expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(mintAmountReward2);

              await newVotingEscrow.connect(player).vestEarning();
              elapsedBlocksForPlayer += 1;
              elapsedBlocksForPlayer2 += 1;

              // wasabi with vesting
              const wasabiRewardAmountForPlayer = wasabiRewardRate*(elapsedBlocksForPlayer-elapsedBlocksForPlayer2) + wasabiRewardRate*elapsedBlocksForPlayer2*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2);
              const wasabiRewardAmountForPlayer2 = wasabiRewardRate*elapsedBlocksForPlayer2*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2);
              expect(await wasabi.balanceOf(await player.getAddress())).equal(mintAmount-lockAmountForPlayer);
              expect(await wasabi.balanceOf(wasabiRewardVesting.address)).gte(wasabiRewardAmountForPlayer - EPSILON).lte(wasabiRewardAmountForPlayer + EPSILON);
              expect(await wasabi.balanceOf(newVotingEscrow.address)).gte(lockAmountForPlayer+lockAmountForPlayer2+wasabiRewardAmountForPlayer2 - EPSILON).lte(lockAmountForPlayer+lockAmountForPlayer2+wasabiRewardAmountForPlayer2 + EPSILON);
              // reward1 with vesting
              expect(await reward1.balanceOf(await player.getAddress())).equal(0);
              expect(await reward1.balanceOf(rewardVesting1.address)).gte(mintAmountReward1+additionalMintAmountReward1*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2) - EPSILON).lte(mintAmountReward1+additionalMintAmountReward1*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2) + EPSILON);
              expect(await reward1.balanceOf(newVotingEscrow.address)).gte(additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2) - EPSILON).lte(additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2) + EPSILON);
              // reward2 without vesting
              expect(await reward2.balanceOf(await player.getAddress())).equal(mintAmountReward2);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(0);
            });

            it("player2 can claim rewards with correct vesting state", async () => {
              expect(await reward1.balanceOf(await collector.getAddress())).equal(additionalMintAmountReward1);
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(mintAmountReward1);
              expect(await reward2.balanceOf(await collector.getAddress())).equal(0);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(mintAmountReward2);

              await newVotingEscrow.connect(player2).vestEarning();
              elapsedBlocksForPlayer += 1;
              elapsedBlocksForPlayer2 += 1;

              const wasabiRewardAmountForPlayer = wasabiRewardRate*(elapsedBlocksForPlayer-elapsedBlocksForPlayer2) + wasabiRewardRate*elapsedBlocksForPlayer2*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2);
              const wasabiRewardAmountForPlayer2 = wasabiRewardRate*elapsedBlocksForPlayer2*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2);
              expect(await wasabi.balanceOf(await player.getAddress())).equal(mintAmount-lockAmountForPlayer);
              expect(await wasabi.balanceOf(wasabiRewardVesting.address)).equal(wasabiRewardAmountForPlayer2);
              expect(await wasabi.balanceOf(newVotingEscrow.address)).equal(lockAmountForPlayer+lockAmountForPlayer2+wasabiRewardAmountForPlayer);
              // reward1 with vesting
              expect(await reward1.balanceOf(await player2.getAddress())).equal(0);
              expect(await reward1.balanceOf(rewardVesting1.address)).equal(additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2));
              expect(await reward1.balanceOf(newVotingEscrow.address)).equal(mintAmountReward1+additionalMintAmountReward1*lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2));
              // reward2 without vesting
              expect(await reward2.balanceOf(await player2.getAddress())).equal(0);
              expect(await reward2.balanceOf(newVotingEscrow.address)).equal(mintAmountReward2);
            });

            it("can get correct reward amount after extend", async () => {
              await newVotingEscrow.connect(player).extendLock(3); // 180+180, veWasabi should double, also send pending wasabi to the vesting;

              elapsedBlocksForPlayer += 1;
              elapsedBlocksForPlayer2 += 1;

              const wasabiRewardAmount = wasabiRewardRate * (elapsedBlocksForPlayer-elapsedBlocksForPlayer2) + wasabiRewardRate * elapsedBlocksForPlayer2 * lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2);
              const wasaboRewardAmountP2 = wasabiRewardRate*elapsedBlocksForPlayer2*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2);
              expect(await newVotingEscrow.balanceOf(await player.getAddress())).equal(lockAmountForPlayer*360/1440);

              expect(((await wasabiRewardVesting.connect(player).withdrawableEarning(await player.getAddress()))['amount'])).gte(BigNumber.from(wasabiRewardAmount).div(2).sub(EPSILON)).lte(BigNumber.from(wasabiRewardAmount).div(2));

              await reward1.mint(await collector.getAddress(), additionalMintAmountReward1);
              elapsedBlocksForPlayer += 1;
              elapsedBlocksForPlayer2 += 1;

              await mineBlocks(ethers.provider, 10);
              elapsedBlocksForPlayer = 11;
              elapsedBlocksForPlayer2 += 10;

              const wasabiRewardAmount2 = wasabiRewardRate * elapsedBlocksForPlayer * lockAmountForPlayer*2/(lockAmountForPlayer*2+lockAmountForPlayer2);
              const wasaboRewardAmountP22 = wasaboRewardAmountP2 + wasabiRewardRate * elapsedBlocksForPlayer * lockAmountForPlayer2/(lockAmountForPlayer*2+lockAmountForPlayer2);
              expect(await newVotingEscrow.connect(player).pendingWasabi(await player.getAddress())).equal(wasabiRewardAmount2);
              expect(await newVotingEscrow.connect(player).pendingReward(await player.getAddress(),reward1.address))
                .equal(additionalMintAmountReward1*lockAmountForPlayer*2/(lockAmountForPlayer*2+lockAmountForPlayer2));
              expect(await newVotingEscrow.connect(player).pendingReward(await player.getAddress(),reward2.address))
                .equal(0);

              expect(await newVotingEscrow.connect(player2).pendingWasabi(await player2.getAddress())).equal(wasaboRewardAmountP22);
              expect(await newVotingEscrow.connect(player2).pendingReward(await player2.getAddress(),reward1.address))
                .equal(additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2) + additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer*2+lockAmountForPlayer2));

            });

            it("can get correct reward amount after add amount", async () => {

              await wasabi.mint(await player.getAddress(), lockAmountForPlayer);
              await newVotingEscrow.connect(player).addAmount(lockAmountForPlayer); // 30+30, veWasabi should double, also send pending wasabi to the vesting;

              elapsedBlocksForPlayer += 2;
              elapsedBlocksForPlayer2 += 2;

              const wasabiRewardAmount = wasabiRewardRate * (elapsedBlocksForPlayer-elapsedBlocksForPlayer2) + wasabiRewardRate * elapsedBlocksForPlayer2 * lockAmountForPlayer/(lockAmountForPlayer+lockAmountForPlayer2);
              const wasaboRewardAmountP2 = wasabiRewardRate*elapsedBlocksForPlayer2*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2);

              expect(((await wasabiRewardVesting.connect(player).withdrawableEarning(await player.getAddress()))['amount'])).gte(BigNumber.from(wasabiRewardAmount).div(2).sub(EPSILON)).lte(BigNumber.from(wasabiRewardAmount).div(2));

              await reward1.mint(await collector.getAddress(), additionalMintAmountReward1);
              elapsedBlocksForPlayer += 1;
              elapsedBlocksForPlayer2 += 1;

              await mineBlocks(ethers.provider, 10);
              elapsedBlocksForPlayer = 11;
              elapsedBlocksForPlayer2 += 10;

              const wasabiRewardAmount2 = wasabiRewardRate * elapsedBlocksForPlayer * lockAmountForPlayer*2/(lockAmountForPlayer*2+lockAmountForPlayer2);
              const wasaboRewardAmountP22 = wasaboRewardAmountP2 + wasabiRewardRate * elapsedBlocksForPlayer * lockAmountForPlayer2/(lockAmountForPlayer*2+lockAmountForPlayer2);
              expect(await newVotingEscrow.connect(player).pendingWasabi(await player.getAddress())).equal(wasabiRewardAmount2);
              expect(await newVotingEscrow.connect(player).pendingReward(await player.getAddress(),reward1.address))
                .gte(additionalMintAmountReward1*lockAmountForPlayer*2/(lockAmountForPlayer*2+lockAmountForPlayer2) - EPSILON).lte(additionalMintAmountReward1*lockAmountForPlayer*2/(lockAmountForPlayer*2+lockAmountForPlayer2) + EPSILON);
              expect(await newVotingEscrow.connect(player).pendingReward(await player.getAddress(),reward2.address))
                .equal(0);

              expect(await newVotingEscrow.connect(player2).pendingWasabi(await player2.getAddress())).gte(wasaboRewardAmountP22 - EPSILON).lte(wasaboRewardAmountP22 + EPSILON);
              expect(await newVotingEscrow.connect(player2).pendingReward(await player2.getAddress(),reward1.address))
                .gte(additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2) + additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer*2+lockAmountForPlayer2) - EPSILON).lte(additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer+lockAmountForPlayer2) + additionalMintAmountReward1*lockAmountForPlayer2/(lockAmountForPlayer*2+lockAmountForPlayer2) + EPSILON);

            });
          });
        });
      });

      context("long user scenario", () => {
        let mintAmountReward1;
        let playerBalance;
        let elapsedBlocks;
        let wasabiRewardRate = 100;

        beforeEach(async () => {
          elapsedBlocks = 0;
          let mintAmount = 1000000;

          await votingEscrow.connect(governance).setWasabiRewardRate(wasabiRewardRate);
          await wasabi.mint(await player.getAddress(), mintAmount);
          await wasabi.connect(player).approve(votingEscrow.address, MAXIMUM_U256);
          await wasabi.mint(await player2.getAddress(), mintAmount);
          await wasabi.connect(player2).approve(votingEscrow.address, MAXIMUM_U256);

          // player creates lock for 30 days
          let lockAmountPlayer = 30000;
          //LockDays enum (0: 7days, 1: 30days, 2:90days, 3:180days,4:360days,5:1440days)
          await votingEscrow.connect(player).createLock(lockAmountPlayer, 3);
          playerBalance = lockAmountPlayer*180/1440;
          expect(await votingEscrow.balanceOf(await player.getAddress())).equal(playerBalance);

          await mineBlocks(ethers.provider, 100);
          elapsedBlocks += 100;

          let wasabiRewardAmount = wasabiRewardRate * (elapsedBlocks);
          expect(await votingEscrow.connect(player).pendingWasabi(await player.getAddress())).gte(wasabiRewardAmount - EPSILON ).lte(wasabiRewardAmount + EPSILON);
          expect(await votingEscrow.connect(player).pendingReward(await player.getAddress(),reward1.address)).equal(0);
          expect(await votingEscrow.connect(player).pendingReward(await player.getAddress(),reward2.address)).equal(0);

          // add reward1 to collector
          mintAmountReward1 = 1000;
          await reward1.mint(await collector.getAddress(), mintAmountReward1);
          elapsedBlocks += 1;
          await reward1.connect(collector).approve(votingEscrow.address, MAXIMUM_U256);
          elapsedBlocks += 1;

          wasabiRewardAmount = wasabiRewardRate * (elapsedBlocks);
          expect(await votingEscrow.connect(player).pendingWasabi(await player.getAddress())).equal(wasabiRewardAmount);
          expect(await votingEscrow.connect(player).pendingReward(await player.getAddress(),reward1.address)).gte(mintAmountReward1 - EPSILON).lte(mintAmountReward1 + EPSILON);
          expect(await votingEscrow.connect(player).pendingReward(await player.getAddress(),reward2.address)).equal(0);
        });

        it("player2 creates lock after player should not get any part of the previous rewards in the collector", async () => {
          // player2 creates lock for 60 days
          let lockAmountPlayer2 = 45000;
          await votingEscrow.connect(player2).createLock(lockAmountPlayer2, 4);
          elapsedBlocks += 1;
          let player2Balance = lockAmountPlayer2*360/1440;
          expect(await votingEscrow.balanceOf(await player2.getAddress())).equal(player2Balance);

          const wasabiRewardAmount = wasabiRewardRate * (elapsedBlocks);
          expect(await votingEscrow.connect(player).pendingWasabi(await player.getAddress())).gte(wasabiRewardAmount - EPSILON).lte(wasabiRewardAmount + EPSILON);
          expect(await votingEscrow.connect(player).pendingReward(await player.getAddress(),reward1.address)).gte(mintAmountReward1 - EPSILON).lte(mintAmountReward1 + EPSILON);
          expect(await votingEscrow.connect(player).pendingReward(await player.getAddress(),reward2.address)).equal(0);
          expect(await votingEscrow.connect(player2).pendingWasabi(await player2.getAddress())).equal(0);
          expect(await votingEscrow.connect(player2).pendingReward(await player2.getAddress(),reward1.address)).equal(0);
          expect(await votingEscrow.connect(player2).pendingReward(await player2.getAddress(),reward2.address)).equal(0);
        });

        it("player and player 2 should get proportional rewards for rewards added after they created locks", async () => {
          // player2 creates lock for 60 days after player collect previous reward
          let lockAmountPlayer2 = 45000;
          await votingEscrow.connect(player2).createLock(lockAmountPlayer2, 4);
          let player2Balance = lockAmountPlayer2*360/1440;
          expect(await votingEscrow.balanceOf(await player2.getAddress())).equal(player2Balance);

          let additionalRewards = 2000;
          await reward1.mint(await collector.getAddress(), additionalRewards);
          await reward1.connect(collector).approve(votingEscrow.address, MAXIMUM_U256);

          expect(await votingEscrow.connect(player).pendingReward(await player.getAddress(),reward1.address)).gte(mintAmountReward1+additionalRewards*playerBalance/(playerBalance+player2Balance) - EPSILON).lte(mintAmountReward1+additionalRewards*playerBalance/(playerBalance+player2Balance) + EPSILON);
          expect(await votingEscrow.connect(player).pendingReward(await player.getAddress(),reward2.address)).equal(0);
          expect(await votingEscrow.connect(player2).pendingReward(await player2.getAddress(),reward1.address)).equal(additionalRewards*player2Balance/(playerBalance+player2Balance));
          expect(await votingEscrow.connect(player2).pendingReward(await player2.getAddress(),reward2.address)).equal(0);
        });
      });
    });
  });
});
