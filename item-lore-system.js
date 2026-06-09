/**
 * ITEM LORE SYSTEM
 * Provides flavor names, type descriptors, and lore entries for all items
 * in the Known Realm of Theos. Styled after Elden Ring / Path of Exile item lore.
 */

/* ──────────────────────────────────────────────────────────────
   ITEM LORE DATA
   Each key is the canonical SHOP_DATA item name.
   flavorName : evocative display name for the backpack
   type       : short descriptor (e.g. "Ritualistic Dagger")
   lore       : 1-2 sentence lore fragment
────────────────────────────────────────────────────────────── */
var ITEM_LORE_DATA = {
  // ── STANDARD WEAPONS ───────────────────────────────────────
  'Sword': {
    flavorName: 'Wayfarer\'s Iron',
    type: 'Standard Longsword',
    lore: 'The blades forged in Gallows Orchard carry a faint hum, said to be the last breath of the smith\'s oath. Every Wayfarer who survives long enough eventually names theirs.'
  },
  'Axe': {
    flavorName: 'Frontier Cleaver',
    type: 'Heavy Chopping Axe',
    lore: 'Dust Colony raiders favored axes because they could split both armor and rationing crates with a single swing. The Frontier has never distinguished between the two.'
  },
  'Mace': {
    flavorName: 'Gate Warden\'s Knell',
    type: 'Crushing Mace',
    lore: 'The Temple Quarter\'s wardens were issued maces, not blades — the Doctrine of Sable held that taking a life through impact left the soul more intact. Few believed it. All carried them anyway.'
  },
  'Rapier': {
    flavorName: 'Court Fang',
    type: 'Precision Thrusting Blade',
    lore: 'Noble courts of the Old Realm banned the rapier three separate times. Each ban produced a black market, and each black market produced a better blade.'
  },
  'Dagger': {
    flavorName: 'Hollowed Fang',
    type: 'Concealable Ritual Dagger',
    lore: 'The cult sects of the Underworld Gate district hollow out the cross-guard of their daggers and fill it with grave-salt — a ward against the spirits they inevitably attract.'
  },
  'Spear': {
    flavorName: 'Long Reach',
    type: 'Infantry Spear',
    lore: 'The Last Sea levies trained on spears because ships could not carry mounted cavalry. After the collapse, the same logic applied to every crumbling city wall in the Known Realm.'
  },
  'Halberd': {
    flavorName: 'Tideguard Polearm',
    type: 'Pole-Axe Halberd',
    lore: 'Ancient halberds recovered from the Shattered Moon Refuge have sigils etched into the haft — navigational runes, as if the wielder expected to fight through the void itself.'
  },
  'Crossbow': {
    flavorName: 'Mechanist\'s Draw',
    type: 'Mechanical Crossbow',
    lore: 'The Scholarium reverse-engineered the crossbow from a single corroded example recovered in the Machine Vaults. Their version jams less. It also weighs considerably more.'
  },
  'Longbow': {
    flavorName: 'Stellarwood Arc',
    type: 'Recurved Longbow',
    lore: 'Bowyers on the Dust Colonies use heartwood from the stellarwood tree, which only grows where old terraforming machines have bled mineral-rich coolant into the soil. The wood never warps.'
  },
  'Pistol': {
    flavorName: 'Compact Sidearm',
    type: 'One-Handed Firearm',
    lore: 'Every soldier, drifter, and temple guard in Theos carries one. The pistol outlasted empires, gods, and the World That Was — mostly because it is simple enough that anyone can fix it.'
  },
  'Shield': {
    flavorName: 'Traveler\'s Bulwark',
    type: 'One-Handed Shield',
    lore: 'Caravan scouts joke that a shield is just a door you carry with you. Old Realm infantry painted their shields with the faces of ancestors — hoping the dead would absorb a blow or two.'
  },

  // ── MELEE EXPANDED ─────────────────────────────────────────
  'Scrap Sword': {
    flavorName: 'Rust-Tongue',
    type: 'Improvised Scrap Blade',
    lore: 'Fashioned from the rusted bones of old-world machinery, scrap swords are considered lucky among Frontier scavengers — proof that something dangerous can be built from ruin.'
  },
  'Tactical Machete': {
    flavorName: 'Clearpath',
    type: 'Military-Grade Machete',
    lore: 'Pre-collapse military units carried these for jungle clearance operations on colony worlds no longer on any map. The blade\'s edge treatment remains unreplicable by current forges.'
  },
  'Chain Whip': {
    flavorName: 'Singing Iron',
    type: 'Weighted Chain Whip',
    lore: 'The Underworld Gate district\'s chain fighters believe the whistle of the chain warns away spirits as effectively as it warns away rivals. The sound became their signature.'
  },
  'Combat Knife': {
    flavorName: 'Last Resort',
    type: 'Close-Quarters Combat Knife',
    lore: 'Mercenaries call their combat knife the "last resort" but reach for it first. It is, as one old contract rider put it, the only tool that has never needed a battery.'
  },
  'Sledgehammer': {
    flavorName: 'Labor\'s End',
    type: 'Repurposed Mining Hammer',
    lore: 'The labor crews of the Machine Vault broke through six kilometers of compacted earth with hammers like this before they found what was buried. They kept the hammers. They left everything else.'
  },
  'Shock Baton': {
    flavorName: 'Blue Sermon',
    type: 'High-Voltage Shock Baton',
    lore: 'Enforcers in the Temple Quarter\'s outer ring were issued these during the Second Doctrinal Crisis. The voltage was later deemed excessive. The doctrine was not reconsidered.'
  },
  'Buzzsaw Axe': {
    flavorName: 'Howling Tooth',
    type: 'Powered Buzzsaw Axe',
    lore: 'Salvagers in the deep hull sectors of orbital wrecks modified excavation saws into weapons when the corridors became contested. The distinctive sound travels through vacuum-rated bulkheads with unsettling ease.'
  },
  'Plasma Blade': {
    flavorName: 'Sundered Edge',
    type: 'Plasma-Emitting Blade',
    lore: 'The Lost Artificers of the Long Ago developed plasma containment for surgery. Their descendants use it to settle disputes. Theos cycles through innovations with remarkable efficiency.'
  },
  'Spiked Gauntlet': {
    flavorName: 'Iron Knuckle',
    type: 'Armored Spiked Gauntlet',
    lore: 'Pit fighters on the Redwake Port docks wear spiked gauntlets as a statement of intent. You do not show up to a Redwake fight in plain gloves — that is considered an insult.'
  },
  'Razor Whip': {
    flavorName: 'Bloodscribe',
    type: 'Razor-Edged Flexible Whip',
    lore: 'Attributed to the assassin-cults operating out of Lantern Quay, the razor whip leaves wounds that scribes of the Old Realm once described as "written into the flesh rather than cut."'
  },
  'Shockwave Hammer': {
    flavorName: 'Gravity\'s Sermon',
    type: 'Gravity-Manipulation Warhammer',
    lore: 'Found only in the deepest ruins of the Machine Vaults, shockwave hammers were never weapons — they were geological survey tools. The Known Realm adapted them, as it adapts everything.'
  },
  'Energy Sword': {
    flavorName: 'Second Sun',
    type: 'Concentrated-Energy Sword',
    lore: 'The Scholarium catalogued twelve distinct energy sword configurations recovered from Long Ago ruins. All twelve were considered religious artifacts by the cultures that built them.'
  },
  'Tesla Lance': {
    flavorName: 'Static Covenant',
    type: 'Electrical Discharge Lance',
    lore: 'The Heaven faction\'s border wardens once carried tesla lances as a show of force. The lances are still there. The border wardens have not been seen in two cycles.'
  },
  'Bone Shiv': {
    flavorName: 'Pale Argument',
    type: 'Sharpened Bone Shiv',
    lore: 'In the Underworld Gate district, a bone shiv is not a weapon of desperation — it is a calling card. Carrying one says everything about where you have been and what you survived to leave.'
  },
  'Riot Shield': {
    flavorName: 'Crowd\'s Edge',
    type: 'Offensive Riot Shield',
    lore: 'The Nine Bell Hollow uprising lasted eleven days. By the last, both sides were carrying riot shields. The archivist who documented it noted that neither side remembered which had originally issued them.'
  },
  'Gravity Mace': {
    flavorName: 'Collapsed Star',
    type: 'Gravity-Manipulation Mace',
    lore: 'There are six recorded instances of gravity maces collapsing small structures during combat. The wielders of three of them survived. The Known Realm considers that a reasonable ratio.'
  },

  // ── RANGED EXPANDED ────────────────────────────────────────
  'Scrap Rifle': {
    flavorName: 'Copper-Throat',
    type: 'Improvised Makeshift Rifle',
    lore: 'Stitched together from irrigation pipe and a salvaged firing mechanism, scrap rifles are the first weapon most Frontier settlers learn to fire and the last they learn to trust.'
  },
  'Compound Bow': {
    flavorName: 'Tensioned Silence',
    type: 'High-Draw Compound Bow',
    lore: 'The Cinder Plaza archery guilds sponsored compound bow development as a "civic art." Their competitions have a higher casualty rate than most mercenary contracts.'
  },
  'Sling': {
    flavorName: 'Shepherd\'s Answer',
    type: 'Simple Stone Sling',
    lore: 'Every child on the Dust Colonies learns to sling before they learn to read. The first is more immediately necessary. The Known Realm\'s most overlooked weapon has ended more than a few careers.'
  },
  'Hand Cannon': {
    flavorName: 'Thunder Argument',
    type: 'Crude Handheld Cannon',
    lore: 'The Dockside syndicates of Vesper Docks carry hand cannons less for combat than for announcement. The sound alone has settled more disagreements than the projectile ever needed to.'
  },
  'Throwing Knives': {
    flavorName: 'Parting Words',
    type: 'Balanced Throwing Knives',
    lore: 'The courier networks of the Known Realm hide throwing knives in ledger bindings, boot heels, and collar hems. Information travels with teeth in Theos.'
  },
  'Energy Pistol': {
    flavorName: 'Arc Whisper',
    type: 'Rare Energy-Based Sidearm',
    lore: 'Energy pistols are almost never sold — they are inherited, stolen, or found on the bodies of people who had no business carrying something so valuable into the situation that killed them.'
  },
  'Harpoon Gun': {
    flavorName: 'Tether-Maker',
    type: 'Modified Harpoon Reel-Gun',
    lore: 'Last Sea hunters used harpoon guns to bring down the void-beasts that breached the upper atmosphere during feeding season. The reel-in mechanism was added after a hunter was briefly dragged skyward and survived.'
  },
  'Pneumatic Dart Rifle': {
    flavorName: 'Quiet Physician',
    type: 'Silent Compressed-Air Rifle',
    lore: 'The Scholarium\'s natural philosophy division designed the pneumatic rifle for specimen collection. Field agents of the Heaven faction found other applications. The design has not been credited to either.'
  },
  'Tactical Laser Rifle': {
    flavorName: 'Long Covenant',
    type: 'Advanced Pre-Collapse Laser Rifle',
    lore: 'Recovered from sealed caches beneath the Glass Ladder Block, tactical laser rifles bear serial numbers that correspond to no known manufacturer. Whatever made them has not made anything since.'
  },
  'Shockwave Blaster': {
    flavorName: 'Resonance Argument',
    type: 'Control-Effect Shockwave Pistol',
    lore: 'Shockwave blasters do not kill — they interrupt. The syndicates of Redwake Port call them "conversation enders," though the conversations they end tend to resume badly.'
  },
  'Recoilless Sniper': {
    flavorName: 'Still Point',
    type: 'Advanced Recoil-Suppressed Sniper',
    lore: 'A single sniper with a recoilless rifle held the Ashbank Bridge for nine days during the Third Doctrinal Conflict. The rifle was later displayed in the Temple Quarter\'s Hall of Instruments. The sniper was not.'
  },
  'Plasma Thrower': {
    flavorName: 'Solis Vein',
    type: 'Superheated Plasma Projector',
    lore: 'Planetary survey teams on the outer colonies carried plasma throwers to melt geological samples. The moment they encountered other survey teams from rival factions, the function shifted permanently.'
  },
  'Flare Gun': {
    flavorName: 'Last Light Signal',
    type: 'Signal Flare Pistol',
    lore: 'Caravans navigating the Frontier Province carry flare guns not as weapons but as promises — proof that someone, somewhere, will see the signal and come. Most wayfarers stop believing this after the second flare.'
  },
  'Bolt-Action Rifle': {
    flavorName: 'Patient Reckoning',
    type: 'Reliable Bolt-Action Rifle',
    lore: 'The Border-Fort labor crews were issued bolt-action rifles on the assumption they would never need to fire them quickly. The assumption proved wrong in ways that have never been officially documented.'
  },
  'Acid Spray Gun': {
    flavorName: 'Corrosion Argument',
    type: 'Corrosive Acid Projector',
    lore: 'Originally developed for stripping paint from reclaimed vessels in the orbital dry-docks, acid spray guns began appearing in Frontier skirmishes within a season of their first manufacture. Industrial tools rarely remain industrial in Theos.'
  },
  'Magnetic Railgun': {
    flavorName: 'Null-Covenant Spar',
    type: 'Magnetic-Field Railgun',
    lore: 'The Heaven faction\'s outer-ring listening posts detected a repeating signal that, when decoded, turned out to be railgun calibration data — broadcast from a dead ship that had been drifting for three hundred years.'
  },

  // ── STANDARD ARMOR ─────────────────────────────────────────
  'Light Armor': {
    flavorName: 'Drifter\'s Shell',
    type: 'Flexible Light Armor',
    lore: 'The standard-issue kit of every caravan scout, frontier drifter, and contract runner in the Known Realm. Lightweight enough to chase a lead. Sturdy enough to survive regretting one.'
  },
  'Balanced Armor': {
    flavorName: 'Wayfarer\'s Pact',
    type: 'Standard Medium Armor',
    lore: 'Designed during the Long Peace by the Cinder Plaza Coalitions as a common accord — every mercenary would wear the same grade, and no one would have a material edge in the halls of negotiation. The Long Peace ended. The armor endured.'
  },
  'Heavy Armor': {
    flavorName: 'Iron Doctrine',
    type: 'Maximum-Protection Heavy Armor',
    lore: 'Temple Quarter wardens who advance to the inner sanctum ranks are encased in Iron Doctrine plate for the ceremony. Half consider it an honor. The other half consider it a warning about what they are expected to withstand.'
  },

  // ── ARMOR EXPANDED ─────────────────────────────────────────
  'Scrap Metal Armor': {
    flavorName: 'Rust Covenant',
    type: 'Improvised Machine Remnant Armor',
    lore: 'Built from the hull plates of decommissioned agricultural mechs, scrap metal armor carries the faint electromagnetic signature of the machines it was stripped from. Some say it confuses targeting systems. No one has confirmed this.'
  },
  'Radiation Cloak': {
    flavorName: 'Pale Veil',
    type: 'Radiation-Reflective Light Cloak',
    lore: 'The Dust Colony radiation cloaks were developed after the fourth terraforming accident in the Sable system. The manufacturer\'s warranty disclaimer is longer than most peace treaties.'
  },
  'Rebar Reinforced Vest': {
    flavorName: 'Rubble Heart',
    type: 'Concrete-Reinforced Combat Vest',
    lore: 'Constructed from the building material of the Nine Bell Hollow ruins, rebar vests are worn by the district\'s defenders as a statement: we are built from this place, and this place does not fall easily.'
  },
  'Vault Door Shield': {
    flavorName: 'Door Without a Room',
    type: 'Repurposed Vault-Door Shield',
    lore: 'The Machine Vault\'s outer doors were rated to withstand atmospheric compression events. Whoever first decided to carry one into combat understood something essential about the relationship between survival and absurdity.'
  },
  'Pneumatic Plate Armor': {
    flavorName: 'Breathing Iron',
    type: 'Pneumatic-Assisted Heavy Plate',
    lore: 'When the pneumatic systems engage, the wearer can feel each breath redirected through the pressure assist — a rhythm the soldiers of the Old Realm called "armor breathing for you." The phrase was not entirely metaphorical.'
  },
  'Kevlar Mesh Bodysuit': {
    flavorName: 'Second Skin',
    type: 'Salvaged Kevlar Bodysuit',
    lore: 'The Scholarium\'s textile division spent forty years trying to replicate the pre-collapse kevlar weave. Their current product is eighty percent as effective and one hundred percent more available. They consider this a success.'
  },
  'Desert Nomad\'s Garb': {
    flavorName: 'Sable Weave',
    type: 'Desert-Fiber Nomad\'s Garb',
    lore: 'Woven from the sandgrass of the outer colony badlands, nomad\'s garb carries the faint mineral scent of the soil it grew from. Wanderers on the Frontier claim it makes tracking dogs hesitate. Wanderers on the Frontier say a lot of things.'
  },
  'Carapace Armor': {
    flavorName: 'Exo-Shell',
    type: 'Giant Insect Carapace Armor',
    lore: 'The carapaces of Frontier-world arthropods have a cellular structure that distributes kinetic impact across their entire surface. Whoever first thought to wear one was either very smart or very desperate. Records do not specify which.'
  },
  'Hydro Suit': {
    flavorName: 'Tidewalk',
    type: 'Toxic-Water Traversal Suit',
    lore: 'Developed for the salvage teams that dive the flooded districts of Lantern Quay, hydro suits carry a secondary lining that neutralizes the chemical cocktail the World That Was left behind in every body of water it touched.'
  },
  'Salvage Shield': {
    flavorName: 'Patchwork Ward',
    type: 'Makeshift Scrap Shield',
    lore: 'A scavenger\'s shield tells a story in its layers — each patch from a different source, a different conflict, a different reason to need something between yourself and what was coming.'
  },

  // ── SCROLLS ────────────────────────────────────────────────
  'Speak with Animals': {
    flavorName: 'Tongue of the Outer Wilds',
    type: 'Communion Scroll',
    lore: 'The Star-Readers of the Frontier believe every creature carries a fragment of the Realm\'s memory. Speaking with beasts is not translation — it is archaeology.'
  },
  'Invisibility': {
    flavorName: 'Between Moments',
    type: 'Concealment Scroll',
    lore: 'The Heaven faction\'s Doctrine of Null teaches that the un-seen are not absent — they are simply occupying the space between observation. Invisibility scrolls were their calling card for three hundred years.'
  },
  'Levitate Object': {
    flavorName: 'Votary\'s Lift',
    type: 'Kinetic Scroll',
    lore: 'Temple Quarter votaries use levitation scrolls to raise offerings above the altar line. The first military application was recorded in the same week the scroll was introduced to the temple quartermaster. Theos is practical about its miracles.'
  },
  'Reveal Traps': {
    flavorName: 'Paranoid Vision',
    type: 'Detection Scroll',
    lore: 'Dungeoneers who survive long enough develop an eye for traps that borders on the mystical. Reveal Traps scrolls are how the rest of us catch up. Briefly.'
  },
  'Night Vision': {
    flavorName: 'Borrowed Dawn',
    type: 'Perception Scroll',
    lore: 'The outer colony night lasts seventeen standard hours. The cultures that developed there built their theology, their cuisine, and their combat doctrine entirely around it. Night Vision scrolls are considered a form of cultural flattery.'
  },
  'Create Light': {
    flavorName: 'Lantern Without a Wick',
    type: 'Illumination Scroll',
    lore: 'The oldest pre-collapse records describe light creation as a sacred act. In the Known Realm, it is simply a convenience. The Realm has efficiently desacralized almost everything it adopted.'
  },
  'Silent Steps': {
    flavorName: 'Hollow Footfall',
    type: 'Stealth Scroll',
    lore: 'The courier networks of Theos consider Silent Steps scrolls a professional necessity rather than a luxury. Their patrons generally agree, and fund the research accordingly.'
  },
  'Create Portal': {
    flavorName: 'Threshold Covenant',
    type: 'Transit Scroll',
    lore: 'Every portal scroll is theoretically unique — keyed to a specific location witnessed by the caster. Scholars debate whether two portals can ever open to the exact same place. Most travelers are glad they cannot.'
  },
  'Fly': {
    flavorName: 'Weightless Covenant',
    type: 'Flight Scroll',
    lore: 'The first human to use a fly scroll recorded the experience as "seeing the Province from the angle of a dead star." The second human to use one crashed into the Redwake harbor and wrote nothing afterward.'
  },
  'Repair Object': {
    flavorName: 'Unbroken Covenant',
    type: 'Restoration Scroll',
    lore: 'Mechanists who have used repair scrolls report that the object being mended briefly "remembers" its original form — as if the scroll is not rebuilding something but rather reminding it what it was.'
  },
  'Plant Growth': {
    flavorName: 'Verdant Argument',
    type: 'Growth Scroll',
    lore: 'In the reclaimed districts of the Old Rail Bastion, plant growth scrolls are used for both construction and concealment in equal measure. The line between garden and fortress in those neighborhoods has never been clearly drawn.'
  },
  'None Can Lie': {
    flavorName: 'The Uncoated Truth',
    type: 'Compulsion Scroll',
    lore: 'The diplomatic corps of the Known Realm outlawed None Can Lie scrolls at the Treaty of Sable Gate — and then immediately established a black market for them. Diplomacy in Theos is honest about its dishonesty.'
  },
  'Empower': {
    flavorName: 'Surge Doctrine',
    type: 'Enhancement Scroll',
    lore: 'Empower scrolls flood the system with what the Scholarium calls "residual light energy" — a term they coined deliberately to avoid the theological implications of calling it what the Temple Quarter believes it actually is.'
  },
  'Speak with the Dead': {
    flavorName: 'Residual Covenant',
    type: 'Necromantic Scroll',
    lore: 'The dead of Theos are not always silent. They are, however, almost never helpful. This has not reduced demand for the scroll — if anything, the ambiguity has increased it.'
  },
  'Bind Oath': {
    flavorName: 'Soul\'s Ledger',
    type: 'Covenant Scroll',
    lore: 'The Sable Gate arbiters used bind oath scrolls for three centuries as the final seal on every major treaty. When the scrolls began to fail, scholars argued it was a manufacturing defect. Politicians argued it was philosophical progress.'
  },
  'Summon Familiar': {
    flavorName: 'The Accompanying Shade',
    type: 'Spirit-Summon Scroll',
    lore: 'Familiars summoned in the outer reaches of the Known Realm tend to take forms the caster did not expect and often cannot explain. Scholars note that they seem to reflect the landscape around the casting point, not the caster\'s intent.'
  },
  'True Name Revealed': {
    flavorName: 'Unveiled Covenant',
    type: 'Revelation Scroll',
    lore: 'In the Scholarium\'s earliest records, a true name was considered the anchor of a soul to the Realm. Revealing one was not discovery — it was a form of profound violation. The scroll is priced accordingly.'
  },

  // ── AUGMENTATIONS ──────────────────────────────────────────
  'NAUTRAM 6T': {
    flavorName: 'Tensored Frame Unit',
    type: 'Body Enhancement Augmentation',
    lore: 'The NAUTRAM series was developed for the decommissioned heavy-labor force of the Machine Vaults. The model designation 6T stands for "sixth iteration, tensile." The previous five iterations are not discussed in any surviving corporate documentation.'
  },
  'AI_EYE': {
    flavorName: 'Targeting Optic Module',
    type: 'Strike Enhancement Augmentation',
    lore: 'The AI eye\'s targeting algorithm was reverse-engineered from automated defense turret firmware recovered in the Frontier. The firmware\'s original purpose was crowd management. The Known Realm found a more intimate application.'
  },
  '3H7-ARCANE': {
    flavorName: 'Cognition Lattice',
    type: 'Mind Enhancement Augmentation',
    lore: 'Scholarium savants who install the 3H7-ARCANE report that their dreams become indexed. Some find this clarifying. Others request removal within the week. The waiting list for both procedures is identical in length.'
  },
  'VOICE SYNTHESIZER': {
    flavorName: 'Phantom Tongue',
    type: 'Spirit Enhancement Augmentation',
    lore: 'Originally developed for diplomatic envoys who needed to address crowds in multiple dialects simultaneously, the Voice Synthesizer was repurposed by the underworld community within a season. The diplomatic corps filed exactly one complaint and then went quiet.'
  },
  'DECENTRALIZED HEART': {
    flavorName: 'Distributed Vital Core',
    type: 'Survival Augmentation',
    lore: 'The Decentralized Heart was designed for deep-void solo pilots who could not afford to die during transit. The design philosophy — distribute critical function across the body to eliminate single points of failure — has become a metaphor in three separate Scholarium dissertations.'
  },
  'SUBDERMAL ARMOR': {
    flavorName: 'Second Skeleton',
    type: 'Defend Enhancement Augmentation',
    lore: 'The installation of subdermal armor requires the patient to remain conscious for the final calibration phase. Surgeons who perform the procedure note that this is when they learn everything meaningful about a person\'s relationship with pain.'
  },
  'ADRENALIN BOOSTER': {
    flavorName: 'Surge Node',
    type: 'Action Enhancement Augmentation',
    lore: 'Adrenalin boosters were initially used by emergency response units who needed to operate for extended periods without rest. They are now used by everyone who can afford one and live with the consequences accordingly.'
  },
  'OPERATING SYSTEM': {
    flavorName: 'Satellite Covenant',
    type: 'OS Interface Augmentation',
    lore: 'The Planet\'s Satellite has been broadcasting on the same frequency since before the World That Was ended. No one built the Operating System to connect to it. The connection was discovered by accident, which is how Theos prefers its most important technologies to begin.'
  },

  // ── OS HACKS ───────────────────────────────────────────────
  'Javelin': {
    flavorName: 'Data-Spike Protocol',
    type: 'Attack OS Hack',
    lore: 'The Javelin was the first offensive hack documented by the Scholarium\'s emerging systems division. It was also the last one they officially acknowledged. The rest of the catalogue exists in a section of their archives labeled "operational anomalies."'
  },
  'Ember': {
    flavorName: 'Vulnerability Cascade',
    type: 'Debuff OS Hack',
    lore: 'An Ember hack does not damage — it opens. Specifically, it opens the gap between a system\'s defensive assumptions and reality. The Scholarium considers this the purest form of digital philosophy in practical application.'
  },
  'Short Circuit': {
    flavorName: 'Lost Time Protocol',
    type: 'Time-Loss OS Hack',
    lore: 'A short circuit hack targets the target\'s chronometric processing. The effect is not blindness or paralysis — the target simply loses track of when they are for exactly long enough to matter.'
  },
  'Take Control': {
    flavorName: 'Remote Covenant',
    type: 'Control OS Hack',
    lore: 'The Heaven faction\'s automated border systems were the first large-scale demonstration of remote control hacking. Whoever demonstrated it left no identifying signature. The border systems remain compromised.'
  },
  'LASHOUT (Master)': {
    flavorName: 'Fractured Will Protocol',
    type: 'Master Compulsion Hack',
    lore: 'LASHOUT was developed in the Black Market underground networks of Vesper Docks by a collective who called themselves the Null-Architects. They sold it once, then disappeared. It has been replicated twelve times by people who found the price of the original too unsettling to ask about.'
  },
  'PARASYTE (Master)': {
    flavorName: 'Bleeding Recursion',
    type: 'Master Damage Hack',
    lore: 'PARASYTE code does not destroy — it propagates itself through the target\'s defensive architecture, converting protection into additional vectors of damage. The Scholarium classifies it as "ethically irregular" in their catalogue, which is the strongest language they use.'
  },

  // ── WEAPON MODS ────────────────────────────────────────────
  'Silencer': {
    flavorName: 'Quiet Accord',
    type: 'Suppressor Weapon Mod',
    lore: 'The courier guilds of the Known Realm had silencers developed under the pretense of "reducing noise pollution in urban districts." The ordinance passed unanimously. No one in the chamber looked at the proposal\'s sponsor while voting.'
  },
  'Reflex Sight': {
    flavorName: 'Precision Optic',
    type: 'Targeting Weapon Mod',
    lore: 'Mass-produced by the surviving orbital manufacturing platforms, reflex sights are one of the few technologies that became better and cheaper simultaneously after the collapse. Scholars believe this is because no one tried to keep the process proprietary.'
  },
  'Kinetic Engine': {
    flavorName: 'Momentum Covenant',
    type: 'Melee Drive Weapon Mod',
    lore: 'The kinetic engine mod harvests the energy of a missed strike and redirects it into the recovery motion. Pit fighters who install it describe the effect as "the weapon apologizing and immediately trying again."'
  },

  // ── ESSENTIALS & SUPPLIES ──────────────────────────────────
  'Depressant': {
    flavorName: 'Void Draught',
    type: 'Trauma-Reducing Consumable',
    lore: 'The medical academies of the Known Realm classify depressants as "palliative intervention." The Frontier outposts classify them as a line item in the operating budget. Both are correct.'
  },
  'Stimulant': {
    flavorName: 'Margin-Walker\'s Edge',
    type: 'Stress-Restoring Consumable',
    lore: 'Temple Quarter apothecaries sell stimulants under a dozen different names and a single consistent warning label. The warning has never been long enough. The names have never been honest enough. Demand has never declined.'
  },
  'Voyager Supplies': {
    flavorName: 'Road Canon',
    type: 'Standard Traveler\'s Provisions',
    lore: 'The Voyager Supplies bundle was standardized by the Caravan Trade Coalition as a universal baseline — every culture in the Known Realm can eat the tinned meat, drink the ale, and need the disinfectant. It is the closest thing Theos has to common ground.'
  },
  'Lamp, Solar': {
    flavorName: 'Captured Afternoon',
    type: 'Solar-Energy Lamp',
    lore: 'Solar lamps recovered from Long Ago ruins still hold charges measured in centuries. The Scholarium\'s energy division has been studying them for forty years and recently admitted they have made no progress understanding them whatsoever.'
  },
  'Healing Salve': {
    flavorName: 'Green Covenant',
    type: 'Wound-Healing Consumable',
    lore: 'The first healing salves were compounded by the caravan herbalists of the Dust Colonies from plants that grew only on the windward face of rockforms. The recipe has been replicated, modified, and debated — but the windward rockform variant is still considered the standard against which the others are measured.'
  },
  'Antitoxin': {
    flavorName: 'Counter-Veil',
    type: 'Poison-Neutralizing Consumable',
    lore: 'The biodiversity of Theos\'s outer colonies means that new poisons are discovered approximately twice as often as new antitoxins. Mercenaries carry antitoxins that cover the most common toxins. What "common" means changes by province.'
  },
  'Blood Purge Phial': {
    flavorName: 'Scar of the Pale Pact',
    type: 'Affliction-Cure Alchemical',
    lore: 'The alchemists who compound Blood Purge Phials never sell them publicly — they are passed to verified buyers through intermediaries, because whoever arranged the formula made clear that anonymity was a condition of access. No one knows why. No one asks.'
  },
  'Moon Tonic': {
    flavorName: 'Borrowed Silver',
    type: 'Affliction-Cure Herbal Remedy',
    lore: 'Temple herbalists who compound Moon Tonic are required by doctrinal law to perform a lunar blessing over each batch. Whether the blessing contributes to efficacy is classified under the Temple Quarter\'s "Uncertain Benefits" research category, which has never published a finding.'
  },
  'Purity Elixir': {
    flavorName: 'Unmarked Covenant',
    type: 'Dual Affliction-Cure Elixir',
    lore: 'The Purity Elixir\'s formula was never codified in any surviving record — each batch is assembled from memory by practitioners who were taught directly. The line of transmission reaches back to before the World That Was ended, and no one in it has ever agreed on what they were originally purifying against.'
  }
};

/* ──────────────────────────────────────────────────────────────
   FALLBACK LORE ENTRIES by category keyword detection
────────────────────────────────────────────────────────────── */
var ITEM_LORE_FALLBACKS = [
  { pattern: /scroll/i, type: 'Arcane Scroll', lore: 'Written in a cipher that fades after reading, scrolls in the Known Realm are single-use repositories of knowledge that the Scholarium classifies as "borrowed possibility."' },
  { pattern: /augmentation/i, type: 'Body Augmentation', lore: 'The augmentation clinics of the Known Realm keep no records by longstanding tradition — a tradition that was deliberately established and is deliberately maintained.' },
  { pattern: /hack/i, type: 'OS Hack Protocol', lore: 'OS Hacks exist in the space between code and intention. The Satellite broadcast they route through predates every faction currently using it.' },
  { pattern: /armor/i, type: 'Protective Armor', lore: 'Every scrape, repair, and replacement piece in a suit of armor is a record of what the wearer survived. Experienced outfitters can read a life story in a single layer of patchwork.' },
  { pattern: /rifle|pistol|gun|bow|sling/i, type: 'Ranged Weapon', lore: 'The Known Realm settled most of its major disputes at range before it settled any of them in person. The weapons reflect a civilization that learned to fear getting close.' },
  { pattern: /sword|axe|mace|blade|dagger|knife|spear|lance|hammer|whip|shield/i, type: 'Melee Weapon', lore: 'Melee weapons in Theos carry the weight of every hand that held them. In a realm spanning the galaxy, close-range violence is always personal.' },
  { pattern: /kit|suitcase|pouch|satchel|roll/i, type: 'Equipment Kit', lore: 'Every toolkit in the Known Realm tells the story of who assembled it and what problem they were afraid of encountering. The most comprehensive kits belong to the most cautious survivors.' },
  { pattern: /ration|supply|bread|food|water/i, type: 'Provisions', lore: 'Out beyond the Province gates, food is diplomacy. The factions that control supply routes control everything else, eventually.' },
  { pattern: /book|codex|log|chronicle|testament/i, type: 'Written Record', lore: 'The Known Realm destroys its libraries more reliably than any other institution. Every surviving book is a minor miracle of stubborn guardianship.' }
];

/**
 * Returns lore data for a given item name.
 * Falls back to pattern-matching if no direct entry found.
 * @param {string} name - the canonical item name
 * @returns {{ flavorName: string, type: string, lore: string } | null}
 */
function getItemLoreData(name) {
  if (!name) return null;
  var clean = String(name).trim();
  // Direct lookup
  if (ITEM_LORE_DATA[clean]) return ITEM_LORE_DATA[clean];
  // Strip affix prefixes and suffixes for lookup (e.g. "Keen Sword" → "Sword")
  var strippedMatch = null;
  Object.keys(ITEM_LORE_DATA).forEach(function(key) {
    if (!strippedMatch && clean.indexOf(key) !== -1) strippedMatch = ITEM_LORE_DATA[key];
  });
  if (strippedMatch) return strippedMatch;
  // Pattern fallback
  for (var i = 0; i < ITEM_LORE_FALLBACKS.length; i++) {
    if (ITEM_LORE_FALLBACKS[i].pattern.test(clean)) {
      return { flavorName: clean, type: ITEM_LORE_FALLBACKS[i].type, lore: ITEM_LORE_FALLBACKS[i].lore };
    }
  }
  return null;
}

/**
 * Builds the collapsible lore tab HTML to inject into item inspection modals.
 * @param {string} name - canonical item name
 * @returns {string} HTML string
 */
function buildItemLoreTabHtml(name) {
  var data = getItemLoreData(name);
  if (!data) return '';
  var uid = 'lore_' + String(name).replace(/[^a-zA-Z0-9]/g, '_') + '_' + Math.floor(Math.random() * 9999);
  var typeHtml = data.type
    ? '<div style="font-size:.7rem;letter-spacing:.08em;color:var(--gold2);text-transform:uppercase;margin-bottom:.35rem;">' + _escapeUiText(data.type) + '</div>'
    : '';
  var loreHtml = '<div style="font-size:.8rem;color:var(--text2);line-height:1.65;font-style:italic;">' + _escapeUiText(data.lore) + '</div>';
  return '<div style="margin-top:.55rem;">'
    + '<button onclick="(function(){var el=document.getElementById(\'' + uid + '\');if(el){el.style.display=el.style.display===\'none\'?\'block\':\'none\';}})()" '
    + 'style="background:none;border:1px solid rgba(201,162,39,.3);border-radius:3px;padding:.18rem .55rem;font-size:.72rem;'
    + 'letter-spacing:.07em;color:var(--gold);cursor:pointer;text-transform:uppercase;width:100%;text-align:left;" '
    + 'title="Toggle item lore">📜 Lore</button>'
    + '<div id="' + uid + '" style="display:none;margin-top:.35rem;padding:.45rem .55rem;'
    + 'border-left:2px solid rgba(201,162,39,.4);background:rgba(201,162,39,.04);border-radius:0 3px 3px 0;">'
    + typeHtml + loreHtml
    + '</div>'
    + '</div>';
}

/**
 * Returns the flavor name for an item if one exists, otherwise returns the original name.
 * @param {string} name
 * @returns {string}
 */
function getItemFlavorName(name) {
  var data = getItemLoreData(name);
  if (data && data.flavorName && data.flavorName !== name) return data.flavorName;
  return name;
}
