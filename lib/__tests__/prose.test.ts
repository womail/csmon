import assert from "node:assert/strict";
import { test } from "node:test";
import { paragraphsToBlocks } from "../article-body";
import { reflowProse } from "../prose";

const GLUED = `Cybersecurity Reporter, Nextgov/FCW
Intelligence Cyber Homeland Congress

House Democrats plan to investigate how the Trump administration’s cuts to the nation’s cyberdefense agency affected its ability to protect federal networks and help states secure elections, while their Senate counterparts vow to scrutinize whether intelligence agencies can deliver findings that contradict the president without putting analysts’ jobs at risk.Rep. Bennie Thompson, D-Miss., who is in line to chair the House Homeland Security Committee when Democrats take both houses of Congress in January, said he and his colleagues would examine the department’s use of its powers against Americans, its immigration enforcement practices, and its dealings with contractors. The party’s wins in both chambers mean Democrats will decide which officials to call before Congress and what records to seek, under subpoena authorities given to whichever party has the majority in a given chamber.If a permanent director for the Cybersecurity and Infrastructure Security Agency is nominated again, Senate Democrats will also have a say in who leads the agency. The same can be said for a nominee to lead the National Counterterrorism Center, whose previous leader resigned earlier this year.“We will investigate the administration weaponizing DHS against Americans, its out of control immigration policies, and its blatantly corrupt self-dealing,” Thompson told Nextgov/FCW. “The American people expect nothing less, and we will deliver.”The panel also plans to examine the department’s surveillance of Americans engaged in protected speech, its handling of whistleblowers and whether federal officials steered contracts to political allies. On cybersecurity, they want to know how DHS is preparing for attacks aided by artificial intelligence and what became of services the department scaled back.What CISA lost in the cutsThompson and Rep. Delia Ramirez, D-Ill., who is positioned to chair the Homeland Security cyber subcommittee, have already asked Congress’ watchdog to assess the impact of staffing cuts at CISA.When intelligence findings conflict with the White HouseRep. Jim Himes, D-Conn., and Sen. Mark Warner, D-Va., are in line to chair the intelligence committees after disputes over whether spy agencies can deliver findings that contradict the president.Who oversees military cyber operationsRep. Adam Smith, D-Wash., and Sen. Jack Reed, D-R.I., are positioned to lead the Armed Services committees. Both lawmakers challenged the administration over the firing of Gen. Timothy Haugh, who led the National Security Agency and U.S. Cyber Command.`;

test("reflow splits glued sentences, quotes, and section headings", () => {
  const parts = reflowProse(GLUED);
  assert.equal(parts[0], "Cybersecurity Reporter, Nextgov/FCW");
  assert.equal(parts[1], "Intelligence Cyber Homeland Congress");
  assert.match(parts[2] ?? "", /^House Democrats plan/);
  assert.match(parts[2] ?? "", /jobs at risk\.$/);
  assert.match(parts[3] ?? "", /^Rep\. Bennie Thompson, D-Miss\., who/);
  assert.match(parts[3] ?? "", /given chamber\.$/);
  assert.match(parts[4] ?? "", /^If a permanent director/);
  assert.match(parts[4] ?? "", /earlier this year\.$/);
  assert.match(parts[5] ?? "", /^“We will investigate/);
  assert.match(parts[5] ?? "", /we will deliver\.”$/);
  assert.match(parts[6] ?? "", /^The panel also plans/);
  assert.match(parts[6] ?? "", /scaled back\.$/);
  assert.equal(parts[7], "What CISA lost in the cuts");
  assert.match(parts[8] ?? "", /^Thompson and Rep\. Delia Ramirez, D-Ill\./);
  assert.match(parts[8] ?? "", /cuts at CISA\.$/);
  assert.equal(parts[9], "When intelligence findings conflict with the White House");
  assert.match(parts[10] ?? "", /^Rep\. Jim Himes, D-Conn\., and Sen\. Mark Warner/);
  assert.equal(parts[11], "Who oversees military cyber operations");
  assert.match(parts[12] ?? "", /^Rep\. Adam Smith, D-Wash\., and Sen\. Jack Reed, D-R\.I\./);
  assert.match(parts[12] ?? "", /U\.S\. Cyber Command\.$/);
  assert.match(parts[12] ?? "", /Gen\. Timothy Haugh/);
});

test("reflow keeps abbreviations, names, and camel case intact", () => {
  const parts = reflowProse(
    "A note on U.S. policy and the JavaScript runtime. Lt.Gen. Jeffrey Kruse stayed on, and Ph.D.Smith filed it. The update shipped.",
  );
  assert.deepEqual(parts, [
    "A note on U.S. policy and the JavaScript runtime. Lt. Gen. Jeffrey Kruse stayed on, and Ph.D. Smith filed it. The update shipped.",
  ]);
});

test("reflow joins a wrapped line and leaves spaced sentences together", () => {
  const parts = reflowProse("House Democrats plan to investigate\nhow the cuts landed. The same can be said for the nominee.");
  assert.deepEqual(parts, [
    "House Democrats plan to investigate how the cuts landed. The same can be said for the nominee.",
  ]);
});

test("display blocks turn recovered section titles into headings", () => {
  const blocks = paragraphsToBlocks(reflowProse(GLUED));
  assert.deepEqual(
    blocks.filter((block) => block.kind === "heading").map((block) => (block.kind === "heading" ? block.text : "")),
    [
      "What CISA lost in the cuts",
      "When intelligence findings conflict with the White House",
      "Who oversees military cyber operations",
    ],
  );
  assert.equal(blocks[0]?.kind, "kicker");
  assert.equal(blocks[1]?.kind, "kicker");
  assert.ok(blocks.some((block) => block.kind === "paragraph" && block.text.startsWith("House Democrats")));
});
