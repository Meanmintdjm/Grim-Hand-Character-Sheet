import React, { useState, useEffect, useCallback } from 'react';

// Tailwind CSS CDN (included in HTML, not needed in React component import)
// <script src="https://cdn.tailwindcss.com"></script>

// Define base stats and bonuses for Race, Class, and Affinity
const BASE_STATS = {
    races: {
        Human: { life: 5, strength: 2, agility: 2, ap: 3, gold: 10, xp: 0, doubt: 0, corruption: 0, attackContribution: 1 },
        Dwarf: { life: 6, strength: 3, agility: 1, ap: 2, gold: 8, xp: 0, doubt: 0, corruption: 0, attackContribution: 2 },
        Elf: { life: 4, strength: 1, agility: 3, ap: 4, gold: 12, xp: 0, doubt: 0, corruption: 0, attackContribution: 1 },
        Orc: { life: 7, strength: 4, agility: 0, ap: 2, gold: 5, xp: 0, doubt: 0, corruption: 0, attackContribution: 2 },
        Goblin: { life: 3, strength: 1, agility: 4, ap: 3, gold: 15, xp: 0, doubt: 0, corruption: 0, attackContribution: 0 },
    },
    classes: {
        Warrior: { life: 6, strength: 3, agility: 1, ap: 2, gold: 7, attackContribution: 2 },
        Ranger: { life: 4, strength: 2, agility: 3, ap: 3, gold: 11, attackContribution: 1 },
        Rogue: { life: 4, strength: 1, agility: 4, ap: 3, gold: 13, attackContribution: 1 },
        Mage: { life: 3, strength: 0, agility: 2, ap: 5, gold: 10, attackContribution: 0 }, // Changed from Mystic to Mage
        Cleric: { life: 5, strength: 2, agility: 1, ap: 3, gold: 8, attackContribution: 1 }, // Changed from Scholar to Cleric and updated stats
    },
    affinities: {
        Blood: { life: 1, strength: 1, agility: 0, ap: 1, gold: 5, attackContribution: 1 },
        Bone: { life: 1, strength: 0, agility: 1, ap: 1, gold: 6, attackContribution: 1 },
        Shadow: { life: 0, strength: 0, agility: 1, ap: 2, gold: 7, attackContribution: 0 },
        Iron: { life: 2, strength: 1, agility: 0, ap: 0, gold: 4, attackContribution: 1 },
        Nature: { life: 1, strength: 0, agility: 2, ap: 1, gold: 8, attackContribution: 0 },
    },
};

// Map poker hand levels to names for display (UPDATED WITH USER'S NAMES)
const POKER_HAND_NAMES = [
    "Desperate Scramble", // Corresponds to High Card (level 0)
    "Unified Effort",    // Corresponds to Pair (level 1)
    "Dual Grip",   // Corresponds to Two Pair (level 2)
    "Triad Impact",  // Corresponds to Three of a Kind (level 3)
    "Unfettered Path",   // Corresponds to Straight (level 4)
    "Pure Affinity",    // Corresponds to Flush (level 5)
    "Anchored Power",   // Corresponds to Full House (level 6)
    "Resonant Force",  // Corresponds to Four of a Kind (level 7)
    "Primal Current", // Corresponds to Straight Flush (level 8)
    "Monolithic Quintessence"    // Corresponds to Five of a Kind (level 9)
];

// Equipment Hand Bonuses (from our previous discussion) - KEYS REMAIN POKER NAMES FOR LOGIC
const EQUIPMENT_HAND_BONUSES = {
    'Pair': { text: "+1 Attack Score", effect: (char) => ({ ...char, totalAttack: char.totalAttack + 1 }) },
    'Two Pair': { text: "+1 Action Point (Max)", effect: (char) => ({ ...char, totalApMax: char.totalApMax + 1 }) },
    'Three of a Kind': { text: "+1 Strength", effect: (char) => ({ ...char, totalStrength: char.totalStrength + 1 }) },
    'Straight': { text: "+1 Agility", effect: (char) => ({ ...char, totalAgility: char.totalAgility + 1 }) },
    'Flush': { text: "+1 Life Essence (Max)", effect: (char) => ({ ...char, totalLifeMax: char.totalLifeMax + 1 }) },
    'Full House': { text: "Reduce all incoming damage by 1 (min 0)", effect: (char) => char }, // This is a specific combat rule, not a stat change
    'Four of a Kind': { text: "+2 Attack Score", effect: (char) => ({ ...char, totalAttack: char.totalAttack + 2 }) },
    'Straight Flush': { text: "+2 Life Essence (Max) OR +1 Action Point (Max)", effect: (char) => ({ ...char, totalLifeMax: char.totalLifeMax + 2, totalApMax: char.totalApMax + 1 }) }, // Combined for simplicity in app, user can choose in game
    'Five of a Kind': { text: "+3 Attack Score", effect: (char) => ({ ...char, totalAttack: char.totalAttack + 3 }) },
};

// Helper function to convert card rank string to number
const getRankValue = (rank) => {
    if (!rank) return 0;
    const upperRank = rank.toUpperCase();
    switch (upperRank) {
        case 'A': return 14; // Ace can be high for poker logic
        case 'K': return 13;
        case 'Q': return 12;
        case 'J': return 11;
        default: return parseInt(upperRank, 10);
    }
};

// Poker hand evaluation logic for any number of cards (0-5)
const evaluatePokerHand = (cards) => {
    // Filter out any null/undefined or incomplete card entries
    const validCards = cards.filter(c => c && c.rank && c.affinity);

    if (validCards.length === 0) {
        // If no valid cards, it's a "High Card" (level 0) with no specific rank
        return { name: "High Card", level: 0 };
    }

    // Sort ranks for straight checks and counting
    const ranks = validCards.map(c => getRankValue(c.rank)).sort((a, b) => a - b);
    const affinities = validCards.map(c => c.affinity);

    // Count occurrences of each rank
    const counts = {};
    ranks.forEach(rank => { counts[rank] = (counts[rank] || 0) + 1; });

    // Helper for straight check (requires 5 cards for a poker straight)
    const isPokerStraight = (rks) => {
        if (rks.length < 5) return false; // Not enough cards for a poker straight
        const uniqueRanks = [...new Set(rks)].sort((a, b) => a - b); // Remove duplicates for straight check
        if (uniqueRanks.length < 5) return false; // Must have 5 unique ranks for a straight

        // Check for A-5 straight (Ace as 1)
        if (uniqueRanks.includes(14) && uniqueRanks.includes(2) && uniqueRanks.includes(3) && uniqueRanks.includes(4) && uniqueRanks.includes(5)) {
            return true;
        }
        // Check for regular straight
        return uniqueRanks.every((val, i) => i === 0 || val === uniqueRanks[i - 1] + 1);
    };

    // Helper for flush check (requires 5 cards for a poker flush)
    const isPokerFlush = (affs) => {
        if (affs.length < 5) return false; // Not enough cards for a poker flush
        return affs.every((val, i, arr) => val && val === arr[0]);
    };

    const currentIsStraight = isPokerStraight(ranks);
    const currentIsFlush = isPokerFlush(affinities);

    // Evaluate hands from highest to lowest, considering card count requirements

    // Monolithic Quintessence (Five of a Kind) - requires 5 cards
    if (validCards.length >= 5 && Object.values(counts).includes(5)) {
        return { name: "Five of a Kind", level: 9 };
    }

    // Primal Current (Straight Flush) - requires 5 cards
    if (validCards.length >= 5 && currentIsStraight && currentIsFlush) {
        return { name: "Straight Flush", level: 8 };
    }

    // Resonant Force (Four of a Kind) - requires at least 4 cards
    if (validCards.length >= 4 && Object.values(counts).includes(4)) {
        return { name: "Four of a Kind", level: 7 };
    }

    // Anchored Power (Full House) - requires 5 cards
    if (validCards.length >= 5 && Object.values(counts).includes(3) && Object.values(counts).includes(2)) {
        return { name: "Full House", level: 6 };
    }

    // Pure Affinity (Flush) - requires 5 cards
    if (validCards.length >= 5 && currentIsFlush) {
        return { name: "Flush", level: 5 };
    }

    // Unfettered Path (Straight) - requires 5 cards
    if (validCards.length >= 5 && currentIsStraight) {
        return { name: "Straight", level: 4 };
    }

    // Triad Impact (Three of a Kind) - requires at least 3 cards
    if (validCards.length >= 3 && Object.values(counts).includes(3)) {
        return { name: "Three of a Kind", level: 3 };
    }

    // Dual Grip (Two Pair) - requires at least 4 cards
    const pairs = Object.values(counts).filter(count => count === 2).length;
    if (validCards.length >= 4 && pairs === 1) { // Changed from pairs === 2 to pairs === 1
        // This logic seems off for "Two Pair". It should be `pairs === 2`.
        // Reverting to `pairs === 2` for Dual Grip (Two Pair) based on standard poker.
        if (pairs === 2) { // Corrected logic for Two Pair
            return { name: "Two Pair", level: 2 };
        }
        // If it's not Two Pair, but there's at least one pair, it's a Pair.
        return { name: "Pair", level: 1 };
    }

    // Unified Effort (One Pair) - requires at least 2 cards
    if (validCards.length >= 2 && pairs === 1) {
        return { name: "Pair", level: 1 };
    }

    // Desperate Scramble (High Card) - if nothing else found but there's at least one card
    return { name: "High Card", level: 0 };
};

function App() {
    const [character, setCharacter] = useState({
        name: "New Recruit",
        race: "Human",
        class: "Warrior",
        affinity: "Iron",
        life: { current: 0, max: 0 },
        strength: 0, // This will hold the total calculated strength
        agility: 0,  // This will hold the total calculated agility
        ap: { current: 0, max: 0 },
        gold: 0,
        xp: 0,
        doubt: 0,
        corruption: 0,
        // Initialize equippedItems with default structure, ItemName will be used for display
        equippedItems: Array(5).fill(null).map((_, i) => ({ id: `slot${i + 1}`, ItemName: null, Rank: null, Affinity: null, PrimaryEffect: "" })),
        portraitUrl: "https://placehold.co/200x200/333/eee?text=Character", // Default placeholder
    });

    const [calculatedStats, setCalculatedStats] = useState({
        baseLifeMax: 0,
        baseStrength: 0,
        baseAgility: 0,
        baseApMax: 0,
        baseGold: 0,
        baseAttack: 0, // Base attack from Race, Class, Affinity

        totalLifeMax: 0,
        totalStrength: 0,
        totalAgility: 0,
        totalApMax: 0,
        totalAttack: 0, // Final Attack Score including equipment
        alignedCardsAttackBonus: 0, // New state for this specific bonus

        currentEquipmentHandBonus: null,
        equipmentHandBonusText: "None",
    });

    const [loreText, setLoreText] = useState("");
    const [questText, setQuestText] = useState("");
    const [isLoadingLore, setIsLoadingLore] = useState(false);
    const [isLoadingQuest, setIsLoadingQuest] = useState(false);
    const [portraitLoadError, setPortraitLoadError] = useState(false); // New state for image load error

    const [xpFormula, setXpFormula] = useState("gold / 2 + strength + agility"); // Default formula
    const [calculatedXpFromFormula, setCalculatedXpFromFormula] = useState(0);
    const [xpFormulaError, setXpFormulaError] = useState("");

    // State for the new Master CSV Link
    const [masterCsvLink, setMasterCsvLink] = useState('');
    const [masterData, setMasterData] = useState([]); // Stores the parsed master CSV data
    const [isLoadingMasterCsv, setIsLoadingMasterCsv] = useState(false);
    const [masterCsvLoadError, setMasterCsvLoadError] = useState('');

    const [characterImageData, setCharacterImageData] = useState([]);
    const [equipmentData, setEquipmentData] = useState([]);
    const [affinityImageData, setAffinityImageData] = useState([]); // New state for affinity image data
    const [filteredEquipmentData, setFilteredEquipmentData] = useState([]); // For search/filter

    const [isLoadingCharacterCsv, setIsLoadingCharacterCsv] = useState(false);
    const [characterCsvLoadError, setCharacterCsvLoadError] = useState('');

    const [isLoadingEquipmentCsv, setIsLoadingEquipmentCsv] = useState(false);
    const [equipmentCsvLoadError, setEquipmentCsvLoadError] = useState('');

    const [isLoadingAffinityCsv, setIsLoadingAffinityCsv] = useState(false); // New state for affinity CSV loading
    const [affinityCsvLoadError, setAffinityCsvLoadError] = useState(''); // New state for affinity CSV error

    const [equipmentSearchTerm, setEquipmentSearchTerm] = useState(''); // State for equipment search

    const [affinityOverlayUrl, setAffinityOverlayUrl] = useState(''); // State for the current affinity overlay image URL
    const [affinityOverlayLoadError, setAffinityOverlayLoadError] = useState(false); // State for affinity overlay image load error

    // New state for background image URL
    const [backgroundImageUrl, setBackgroundImageUrl] = useState('');


    // State for active tab
    const [activeTab, setActiveTab] = useState('characterInfo'); // 'characterInfo', 'statsXp', 'equipment', 'aiInsights', 'systems', 'gameGuide'
    // State for active game guide section
    const [activeGuideSection, setActiveGuideSection] = useState('overview'); // 'overview', 'pokerHands', 'equipmentBonuses', 'baseStats'


    // Function to parse CSV text into an array of objects
    // This improved version handles quoted fields correctly.
    const parseCSV = (csvText) => {
        const lines = csvText.trim().split('\n');
        if (lines.length === 0) {
            return [];
        }

        const headers = [];
        // Use a regex to split the header line, accounting for quoted commas
        const headerMatches = lines[0].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (headerMatches) {
            headerMatches.forEach(h => headers.push(h.replace(/"/g, '').trim()));
        } else {
            // Fallback for simple headers without quotes
            lines[0].split(',').forEach(h => headers.push(h.trim()));
        }

        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();

            if (!line) {
                continue; // Skip truly empty lines
            }

            const values = [];
            // Regex to split by comma, but not if inside double quotes
            // Also handles escaped double quotes within fields ("" becomes "")
            const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g;
            let match;
            let currentValues = [];
            while ((match = regex.exec(line)) !== null) {
                // If it's a quoted field (group 1), remove outer quotes and unescape inner quotes
                // If it's an unquoted field (group 2), just take it
                let value = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
                currentValues.push(value.trim());
            }

            // Remove the first empty string if the line started with a comma (due to regex behavior)
            // This is a common artifact of the regex when the first field is empty or line starts with comma.
            if (currentValues.length > 0 && currentValues[0] === '' && line.startsWith(',')) {
                currentValues.shift();
            }

            // Filter out empty strings that might result from trailing commas or multiple consecutive commas
            const filteredValues = currentValues.filter(v => v !== '');

            // Check if the number of filtered values matches the number of headers
            if (filteredValues.length !== headers.length) {
                console.warn(`Skipping malformed row ${i + 1} (column count mismatch). Expected ${headers.length}, got ${filteredValues.length}: "${line}"`);
                continue;
            }
            // Also check if all filtered values are empty (e.g., a line with just ",,,")
            if (filteredValues.every(v => v === '')) {
                console.warn(`Skipping empty row ${i + 1} after filtering: "${line}"`);
                continue;
            }

            const row = {};
            headers.forEach((header, index) => {
                row[header] = filteredValues[index]; // Use filtered values
            });
            data.push(row);
        }
        return data;
    };

    // New function to load the master CSV data
    const loadMasterData = useCallback(async () => {
        if (!masterCsvLink) {
            setMasterCsvLoadError('Please paste your Master Data Source CSV published link above.');
            setMasterData([]);
            setCharacterImageData([]);
            setEquipmentData([]);
            setAffinityImageData([]); // Clear affinity data
            setFilteredEquipmentData([]);
            return;
        }

        setIsLoadingMasterCsv(true);
        setMasterCsvLoadError('');
        setMasterData([]);
        setCharacterImageData([]);
        setEquipmentData([]);
        setAffinityImageData([]); // Clear affinity data
        setFilteredEquipmentData([]);

        try {
            const response = await fetch(masterCsvLink);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            const parsedData = parseCSV(text);
            setMasterData(parsedData);
            setMasterCsvLoadError('');
        } catch (error) {
            console.error("Error loading Master CSV:", error);
            setMasterCsvLoadError(`Failed to load Master CSV: ${error.message}. Ensure the link is correct and the sheet is published to web as CSV.`);
        } finally {
            setIsLoadingMasterCsv(false);
        }
    }, [masterCsvLink]);


    // Function to load character image data from the master data
    const loadCharacterImages = useCallback(async (link) => {
        if (!link) {
            setCharacterCsvLoadError('Character Images link not found in Master CSV.');
            setCharacterImageData([]);
            return;
        }

        setIsLoadingCharacterCsv(true);
        setCharacterCsvLoadError('');
        try {
            const response = await fetch(link);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            const parsedData = parseCSV(text);
            setCharacterImageData(parsedData);
            setCharacterCsvLoadError('');
        } catch (error) {
            console.error("Error loading Character Images CSV:", error);
            setCharacterCsvLoadError(`Failed to load Character Images CSV: ${error.message}.`);
        } finally {
            setIsLoadingCharacterCsv(false);
        }
    }, []);

    // Function to load equipment data from the master data
    const loadEquipmentData = useCallback(async (link) => {
        if (!link) {
            setEquipmentCsvLoadError('Equipment Data link not found in Master CSV.');
            setEquipmentData([]);
            setFilteredEquipmentData([]);
            return;
        }

        setIsLoadingEquipmentCsv(true);
        setEquipmentCsvLoadError('');
        try {
            const response = await fetch(link);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            const parsedData = parseCSV(text);
            setEquipmentData(parsedData);
            setFilteredEquipmentData(parsedData); // Initialize filtered data
            setEquipmentCsvLoadError('');
        } catch (error) {
            console.error("Error loading Equipment Data CSV:", error);
            setEquipmentCsvLoadError(`Failed to load Equipment Data CSV: ${error.message}.`);
        } finally {
            setIsLoadingEquipmentCsv(false);
        }
    }, []);

    // New function to load affinity image data from the master data
    const loadAffinityData = useCallback(async (link) => {
        if (!link) {
            setAffinityCsvLoadError('Affinity Data link not found in Master CSV.');
            setAffinityImageData([]);
            return;
        }

        setIsLoadingAffinityCsv(true);
        setAffinityCsvLoadError('');
        try {
            const response = await fetch(link);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            const parsedData = parseCSV(text);
            setAffinityImageData(parsedData);
            setAffinityCsvLoadError('');
        } catch (error) {
            console.error("Error loading Affinity Data CSV:", error);
            setAffinityCsvLoadError(`Failed to load Affinity Data CSV: ${error.message}.`);
        } finally {
            setIsLoadingAffinityCsv(false);
        }
    }, []);


    // Effect to load master data when masterCsvLink changes
    useEffect(() => {
        loadMasterData();
    }, [loadMasterData]);

    // Effect to load individual data sources once masterData is available
    useEffect(() => {
        if (masterData.length > 0) {
            const charLinkEntry = masterData.find(entry => entry.Type === 'CharacterImages');
            if (charLinkEntry && charLinkEntry.Link) {
                loadCharacterImages(charLinkEntry.Link);
            } else {
                setCharacterCsvLoadError('CharacterImages link not found in Master CSV.');
                setCharacterImageData([]);
            }

            const equipLinkEntry = masterData.find(entry => entry.Type === 'EquipmentData');
            if (equipLinkEntry && equipLinkEntry.Link) {
                loadEquipmentData(equipLinkEntry.Link);
            } else {
                setEquipmentCsvLoadError('EquipmentData link not found in Master CSV.');
                setEquipmentData([]);
                setFilteredEquipmentData([]);
            }

            const affinityLinkEntry = masterData.find(entry => entry.Type === 'AffinityData'); // Look for AffinityData
            if (affinityLinkEntry && affinityLinkEntry.Link) {
                loadAffinityData(affinityLinkEntry.Link);
            } else {
                setAffinityCsvLoadError('AffinityData link not found in Master CSV.');
                setAffinityImageData([]);
            }

        } else if (!isLoadingMasterCsv && masterCsvLink) {
            // If masterData is empty but not loading and a link is provided,
            // it means master CSV was loaded but had no data or relevant entries.
            setCharacterCsvLoadError('Master CSV loaded, but no CharacterImages entry found.');
            setEquipmentCsvLoadError('Master CSV loaded, but no EquipmentData entry found.');
            setAffinityCsvLoadError('Master CSV loaded, but no AffinityData entry found.'); // Update for affinity
            setCharacterImageData([]);
            setEquipmentData([]);
            setAffinityImageData([]); // Clear affinity data
            setFilteredEquipmentData([]);
        }
    }, [masterData, isLoadingMasterCsv, masterCsvLink, loadCharacterImages, loadEquipmentData, loadAffinityData]);


    // Function to update portrait based on CSV data
    const updatePortraitFromCSV = useCallback(() => {
        if (characterImageData.length === 0) {
            // If no image data loaded, revert to default placeholder
            setCharacter(prev => ({
                ...prev,
                portraitUrl: "https://placehold.co/200x200/333/eee?text=Character"
            }));
            setPortraitLoadError(false);
            return;
        }

        // Match only on Race and Class
        const foundEntry = characterImageData.find(entry =>
            entry.Race === character.race &&
            entry.Class === character.class
        );

        if (foundEntry && foundEntry.ImageLink) {
            setCharacter(prev => ({ ...prev, portraitUrl: foundEntry.ImageLink }));
            setPortraitLoadError(false); // Clear any previous image load error
        } else {
            // Fallback to default if no specific match found in CSV
            setCharacter(prev => ({
                ...prev,
                portraitUrl: "https://placehold.co/200x200/333/eee?text=Character"
            }));
            setPortraitLoadError(false); // Clear any previous image load error
        }
    }, [character.race, character.class, characterImageData]);

    // New function to update affinity overlay based on CSV data
    const updateAffinityOverlay = useCallback(() => {
        console.log("Affinity Debug: updateAffinityOverlay called.");
        console.log("Affinity Debug: Current character affinity:", character.affinity);
        console.log("Affinity Debug: Loaded affinityImageData (count):", affinityImageData.length, affinityImageData);

        if (affinityImageData.length === 0) {
            setAffinityOverlayUrl(''); // Clear overlay if no data
            setAffinityOverlayLoadError(false);
            console.log("Affinity Debug: Affinity image data is empty. Clearing overlay URL.");
            return;
        }

        const foundEntry = affinityImageData.find(entry => {
            // Use .trim() on entry.AffinityName to remove any leading/trailing whitespace from CSV
            const trimmedAffinityName = entry.AffinityName ? entry.AffinityName.trim() : '';
            console.log(`Affinity Debug: Comparing CSV AffinityName "${trimmedAffinityName}" with character affinity "${character.affinity}"`);
            return trimmedAffinityName === character.affinity;
        });

        if (foundEntry && foundEntry.ImageLink) {
            setAffinityOverlayUrl(foundEntry.ImageLink);
            setAffinityOverlayLoadError(false);
            console.log("Affinity Debug: Setting affinity overlay URL to:", foundEntry.ImageLink);
        } else {
            setAffinityOverlayUrl(''); // Clear if no match
            setAffinityOverlayLoadError(false); // No error, just no specific image
            console.log("Affinity Debug: No affinity image link found for", character.affinity, ". Clearing overlay URL.");
        }
    }, [character.affinity, affinityImageData]);


    // Function to calculate all derived stats
    const calculateAllStats = useCallback(() => {
        const raceStats = BASE_STATS.races[character.race];
        const classStats = BASE_STATS.classes[character.class];
        const affinityStats = BASE_STATS.affinities[character.affinity];

        // Base stats from Race, Class, Affinity (for display in new section)
        const initialLifeMax = raceStats.life + classStats.life + affinityStats.life;
        const initialStrength = raceStats.strength + classStats.strength + affinityStats.strength;
        const initialAgility = raceStats.agility + classStats.agility + affinityStats.agility;
        const initialApMax = raceStats.ap + classStats.ap + affinityStats.ap;
        const initialGold = raceStats.gold + classStats.gold + affinityStats.gold; // Sum gold from all three
        const initialAttack = raceStats.attackContribution + classStats.attackContribution + affinityStats.attackContribution; // Sum attack from all three

        // Start with these initial sums for further calculations
        let currentLifeMax = initialLifeMax;
        let currentStrength = initialStrength;
        let currentAgility = initialAgility;
        let currentApMax = initialApMax;
        let currentAttack = initialAttack;

        // Apply equipped item affinity bonuses (individual item bonuses for Life, Agility, AP, Strength)
        character.equippedItems.forEach(item => {
            // Ensure item and its Affinity property exist before checking
            if (item && item.Affinity && item.Affinity === character.affinity) {
                switch (item.Affinity) {
                    case 'Blood':
                    case 'Nature':
                        currentLifeMax += 1;
                        break;
                    case 'Bone':
                        currentAgility += 1;
                        break;
                    case 'Shadow':
                        currentApMax += 1;
                        break;
                    case 'Iron':
                        currentStrength += 1;
                        break;
                    default:
                        break;
                }
            }
        });

        // NEW LOGIC: +1 Attack Score for every aligned equipped item (interpreted as "community card")
        let alignedCardsAttackBonus = 0;
        character.equippedItems.forEach(item => {
            // Ensure item and its Affinity property exist before checking
            if (item && item.Affinity && item.Affinity === character.affinity) {
                alignedCardsAttackBonus += 1;
            }
        });
        currentAttack += alignedCardsAttackBonus; // Add this bonus to the total attack

        // Evaluate Equipment Hand Bonus
        // Ensure that 'Rank' and 'Affinity' properties are used as per CSV headers
        const validEquippedCards = character.equippedItems.filter(item => item && item.Rank && item.Affinity).map(item => ({ rank: item.Rank, affinity: item.Affinity }));
        let equipmentHandResult = { name: "High Card", level: 0 }; // Default to High Card if no valid cards or no specific hand
        if (validEquippedCards.length > 0) { // Only evaluate if there's at least one valid card
            equipmentHandResult = evaluatePokerHand(validEquippedCards);
        }

        let equipmentHandBonusEffect = null;
        let equipmentHandBonusText = "None"; // Default if no bonus applies

        // Use the POKER_HAND_NAMES array to get the display name based on the level
        const displayHandName = equipmentHandResult.level !== -1 ? POKER_HAND_NAMES[equipmentHandResult.level] : "No Hand"; // "No Hand" if invalid

        if (equipmentHandResult.level >= 0 && EQUIPMENT_HAND_BONUSES[equipmentHandResult.name]) {
            equipmentHandBonusEffect = EQUIPMENT_HAND_BONUSES[equipmentHandResult.name].effect;
            equipmentHandBonusText = `${displayHandName}: ${EQUIPMENT_HAND_BONUSES[equipmentHandResult.name].text}`;

            // Apply equipment hand bonuses to current stats
            const tempCharForBonusCalc = {
                totalLifeMax: currentLifeMax,
                totalStrength: currentStrength,
                totalAgility: currentAgility,
                totalApMax: currentApMax,
                totalAttack: currentAttack,
            };
            const afterHandBonus = equipmentHandBonusEffect(tempCharForBonusCalc);

            currentLifeMax = afterHandBonus.totalLifeMax;
            currentStrength = afterHandBonus.totalStrength;
            currentAgility = afterHandBonus.totalAgility;
            currentApMax = afterHandBonus.totalApMax;
            currentAttack = afterHandBonus.totalAttack;
        } else if (equipmentHandResult.level === -1) {
            equipmentHandBonusText = "Invalid or Incomplete Card Data"; // More generic message
        } else {
            // This covers cases where a hand is identified (e.g., High Card) but has no bonus defined
            equipmentHandBonusText = `${displayHandName}: No bonus for this hand.`;
        }


        setCalculatedStats({
            baseLifeMax: initialLifeMax,
            baseStrength: initialStrength,
            baseAgility: initialAgility,
            baseApMax: initialApMax,
            baseGold: initialGold,
            baseAttack: initialAttack,

            totalLifeMax: currentLifeMax,
            totalStrength: currentStrength,
            totalAgility: currentAgility,
            totalApMax: currentApMax,
            totalAttack: currentAttack,
            alignedCardsAttackBonus: alignedCardsAttackBonus, // Store the new bonus value

            currentEquipmentHandBonus: displayHandName, // Store the display name
            equipmentHandBonusText: equipmentHandBonusText,
        });

    }, [character.race, character.class, character.affinity, character.equippedItems]);


    // Initialize stats when race/class/affinity changes
    useEffect(() => {
        console.log("Affinity Debug: Character race/class/affinity changed. Triggering stat and image updates.");
        const raceStats = BASE_STATS.races[character.race];
        const classStats = BASE_STATS.classes[character.class];
        const affinityStats = BASE_STATS.affinities[character.affinity];

        const initialLifeMax = raceStats.life + classStats.life + affinityStats.life;
        const initialApMax = raceStats.ap + classStats.ap + affinityStats.ap;
        const initialGold = raceStats.gold + classStats.gold + affinityStats.gold;

        setCharacter(prev => ({
            ...prev,
            // Preserve current life and AP, but cap them at the new max
            life: {
                current: Math.min(prev.life.current, initialLifeMax),
                max: initialLifeMax
            },
            ap: {
                current: Math.min(prev.ap.current, initialApMax),
                max: initialApMax
            },
            // Only set initial gold if it's currently 0, otherwise keep existing gold
            gold: prev.gold === 0 ? initialGold : prev.gold,
            xp: 0, // Reset XP, Doubt, Corruption on character re-selection
            doubt: 0,
            corruption: 0,
            // portraitUrl is now handled by updatePortraitFromCSV or manual input
        }));
        setPortraitLoadError(false); // Reset error on character change
        // Recalculate all derived stats including equipment bonuses
        // This call will update strength, agility, and totalAttack based on the new selections
        calculateAllStats();
        // Only update portrait if characterImageData is available and not loading
        if (characterImageData.length > 0 && !isLoadingCharacterCsv) {
            updatePortraitFromCSV();
        }
        // Update affinity overlay when affinity changes
        updateAffinityOverlay();
    }, [character.race, character.class, character.affinity, calculateAllStats, updatePortraitFromCSV, updateAffinityOverlay, characterImageData.length, isLoadingCharacterCsv]);

    // Recalculate all derived stats whenever equipped items change
    useEffect(() => {
        calculateAllStats();
    }, [character.equippedItems, calculateAllStats]);

    // Effect to update portrait when characterImageData changes (after CSV load)
    useEffect(() => {
        console.log("Affinity Debug: characterImageData changed. Triggering portrait update.");
        if (characterImageData.length > 0) {
            updatePortraitFromCSV();
        }
    }, [characterImageData, updatePortraitFromCSV]);

    // Effect to update affinity overlay when affinityImageData changes (after CSV load)
    useEffect(() => {
        console.log("Affinity Debug: affinityImageData changed. Triggering affinity overlay update.");
        if (affinityImageData.length > 0) {
            updateAffinityOverlay();
        }
    }, [affinityImageData, updateAffinityOverlay]);


    // Effect to recalculate XP from formula
    useEffect(() => {
        try {
            // Create a scope for the eval function
            const scope = {
                lifeCurrent: character.life.current,
                lifeMax: calculatedStats.totalLifeMax,
                strength: calculatedStats.totalStrength, // Use calculated strength
                agility: calculatedStats.totalAgility,   // Use calculated agility
                apCurrent: character.ap.current,
                apMax: calculatedStats.totalApMax,
                gold: character.gold,
                xp: character.xp,
                doubt: character.doubt,
                corruption: character.corruption,
                attack: calculatedStats.totalAttack,
            };

            // Use a function to execute the formula within the defined scope
            const calculate = new Function('scope', `with(scope) { return ${xpFormula}; }`);
            const result = calculate(scope);

            if (typeof result === 'number' && !isNaN(result)) {
                setCalculatedXpFromFormula(Math.floor(result)); // Round down XP
                setXpFormulaError("");
            } else {
                setXpFormulaError("Invalid Formula Result");
            }
        } catch (error) {
            setXpFormulaError("Invalid Formula Syntax");
            console.error("XP Formula Error:", error);
        }
    }, [xpFormula, character, calculatedStats]);


    // Handler for direct input changes (e.g., typing a number into the field)
    const handleStatInputChange = (statName, value) => {
        setCharacter(prev => {
            const newChar = { ...prev };
            const parsedValue = parseInt(value, 10);

            // If input is not a number, or empty, do not update the state
            if (isNaN(parsedValue) && value !== '') {
                return prev;
            }

            // Handle specific stats
            if (statName === 'lifeCurrent') {
                newChar.life.current = Math.max(0, Math.min(newChar.life.max, parsedValue));
            } else if (statName === 'apCurrent') {
                newChar.ap.current = Math.max(0, Math.min(newChar.ap.max, parsedValue));
            } else if (statName === 'gold' || statName === 'xp' || statName === 'doubt' || statName === 'corruption') {
                newChar[statName] = Math.max(0, parsedValue);
            }
            return newChar;
        });
    };

    // Handler for increment/decrement buttons
    const handleIncrementDecrement = (statName, amount) => {
        setCharacter(prev => {
            const newChar = { ...prev };
            if (statName === 'lifeCurrent') {
                newChar.life.current = Math.max(0, Math.min(newChar.life.max, prev.life.current + amount));
            } else if (statName === 'apCurrent') {
                newChar.ap.current = Math.max(0, Math.min(prev.ap.current + amount));
            } else if (statName === 'gold' || statName === 'xp' || statName === 'doubt' || statName === 'corruption') {
                newChar[statName] = Math.max(0, prev[statName] + amount);
            }
            return newChar;
        });
    };

    const handleCharacterChange = (e) => {
        const { name, value } = e.target;
        setCharacter(prev => ({ ...prev, [name]: value }));
    };

    // Modified handleEquippedItemChange to work with selected item from CSV data
    const handleEquippedItemChange = (slotId, selectedItemName) => {
        setCharacter(prev => {
            const newEquippedItems = prev.equippedItems.map(item => {
                if (item.id === slotId) {
                    // Find the full item data from the loaded equipmentData
                    const selectedItem = equipmentData.find(dataItem => dataItem.ItemName === selectedItemName);
                    if (selectedItem) {
                        // Map CSV headers to the expected properties
                        return {
                            ...item,
                            ItemName: selectedItem.ItemName,
                            Rank: selectedItem.Rank, // Assuming CSV has a 'Rank' column
                            Affinity: selectedItem.Affinity, // Assuming CSV has an 'Affinity' column
                            PrimaryEffect: selectedItem.PrimaryEffect || "", // Assuming CSV has 'PrimaryEffect'
                        };
                    } else {
                        // If selectedItemName is empty or not found, clear the slot
                        return { id: slotId, ItemName: null, Rank: null, Affinity: null, PrimaryEffect: "" };
                    }
                }
                return item;
            });
            return { ...prev, equippedItems: newEquippedItems };
        });
    };

    const handlePortraitUrlChange = (e) => {
                setCharacter(prev => ({ ...prev, portraitUrl: e.target.value }));
                setPortraitLoadError(false); // Reset error when URL changes
            };

    const handleEquipmentSearch = (e) => {
        const term = e.target.value.toLowerCase();
        setEquipmentSearchTerm(term);
        if (term) {
            setFilteredEquipmentData(
                equipmentData.filter(item =>
                    item.ItemName.toLowerCase().includes(term) ||
                    (item.Affinity && item.Affinity.toLowerCase().includes(term)) ||
                    (item.PrimaryEffect && item.PrimaryEffect.toLowerCase().includes(term))
                )
            );
        } else {
            setFilteredEquipmentData(equipmentData);
        }
    };


    // LLM Integration Functions
    const generateLore = async () => {
        setIsLoadingLore(true);
        setLoreText("");
        try {
            const prompt = `Generate a short, grimdark backstory for a ${character.race} ${character.class} with ${character.affinity} Affinity in a world called Grim Hand. Focus on their origins, a significant event that shaped them, and why they might be adventuring. Keep it concise, around 100-150 words.`;
            let chatHistory = [];
            chatHistory.push({ role: "user", parts: [{ text: prompt }] });
            const payload = { contents: chatHistory };
            const apiKey = ""; // If you want to use models other than gemini-2.0-flash or imagen-3.0-generate-002, provide an API key here. Otherwise, leave this as-is.
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                setLoreText(result.candidates[0].content.parts[0].text);
            } else {
                setLoreText("Failed to generate lore. Please try again.");
            }
        } catch (error) {
            console.error("Error generating lore:", error);
            setLoreText("An error occurred while generating lore.");
        } finally {
            setIsLoadingLore(false);
        }
    };

    const suggestPersonalQuest = async () => {
        setIsLoadingQuest(true);
        setQuestText("");
        try {
            const equippedItemsDescription = character.equippedItems
                .filter(item => item && item.ItemName) // Use ItemName for description
                .map(item => `${item.ItemName} (Rank: ${item.Rank}, Affinity: ${item.Affinity}, Effect: ${item.PrimaryEffect || 'none'})`)
                .join(', ');

            const prompt = `Based on a ${character.race} ${character.class} with ${character.affinity} Affinity, and their current stats (Strength: ${calculatedStats.totalStrength}, Agility: ${calculatedStats.totalAgility}, Life: ${character.life.current}/${calculatedStats.totalLifeMax}, Gold: ${character.gold}, XP: ${character.xp}, Doubt: ${character.doubt}, Corruption: ${character.corruption}). They have equipped: ${equippedItemsDescription || 'no items'}. Suggest a short, grimdark personal quest idea for them. Focus on a unique challenge or objective that ties into their background or current state. Keep it concise, around 50-80 words.`;
            let chatHistory = [];
            chatHistory.push({ role: "user", parts: [{ text: prompt }] });
            const payload = { contents: chatHistory };
            const apiKey = ""; // If you want to use models other than gemini-2.0-flash or imagen-3.0-generate-002, provide an API key here. Otherwise, leave this as-is.
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                setQuestText(result.candidates[0].content.parts[0].text);
            } else {
                setQuestText("Failed to suggest a quest. Please try again.");
            }
        } catch (error) {
            console.error("Error suggesting quest:", error);
            setQuestText("An error occurred while suggesting a quest.");
        } finally {
            setIsLoadingQuest(false);
        }
    };

    return (
        <div
            className="min-h-screen font-inter p-4 sm:p-6 lg:p-8 rounded-lg shadow-lg" // Removed text-gray-100 here
            style={{
                backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed',
                backgroundColor: backgroundImageUrl ? 'transparent' : '#1a202c', // Fallback color if no image
            }}
        >
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Metal+Mania&display=swap');
                /* Removed body font family override */
                .font-inter-only { font-family: 'Inter', sans-serif; } /* Specific class for Inter font */

                /* Custom styles for the "book" elements */
                .book-button {
                    background-color: #4a5568; /* Gray-700 */
                    color: #e2e8f0; /* Gray-200 */
                    font-weight: 600;
                    padding: 0.75rem 1.5rem;
                    border-radius: 0.5rem; /* rounded-lg */
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); /* shadow-md */
                    transition: all 0.2s ease-in-out;
                    border: 1px solid #2d3748; /* Gray-800 */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    text-align: center;
                    min-height: 4rem; /* Ensure some height for readability */
                }
                .book-button:hover {
                    background-color: #2d3748; /* Gray-800 */
                    transform: translateY(-2px);
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                }
                .book-button.active {
                    background-color: #c53030; /* Red-700 */
                    color: white;
                    border-color: #9b2c2c; /* Darker red */
                    transform: translateY(0);
                }
                `}
            </style>
            <h1 className="text-4xl sm:text-5xl font-bold text-center text-red-500 mb-8 drop-shadow-lg">
                Grim Hand Character Sheet
            </h1>

            {/* Tab Navigation */}
            <div className="flex justify-center mb-6 flex-wrap gap-2"> {/* Added flex-wrap and gap for responsiveness */}
                <button
                    className={`px-4 py-2 rounded-t-lg font-semibold transition-colors duration-200 ${activeTab === 'characterInfo' ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    onClick={() => setActiveTab('characterInfo')}
                >
                    Character Info
                </button>
                <button
                    className={`px-4 py-2 rounded-t-lg font-semibold transition-colors duration-200 ${activeTab === 'statsXp' ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    onClick={() => setActiveTab('statsXp')}
                >
                    Stats & XP
                </button>
                <button
                    className={`px-4 py-2 rounded-t-lg font-semibold transition-colors duration-200 ${activeTab === 'equipment' ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    onClick={() => setActiveTab('equipment')}
                >
                    Equipment
                </button>
                <button
                    className={`px-4 py-2 rounded-t-lg font-semibold transition-colors duration-200 ${activeTab === 'aiInsights' ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    onClick={() => setActiveTab('aiInsights')}
                >
                    AI Insights
                </button>
                <button
                    className={`px-4 py-2 rounded-t-lg font-semibold transition-colors duration-200 ${activeTab === 'gameGuide' ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    onClick={() => setActiveTab('gameGuide')}
                >
                    Game Guide
                </button>
                <button
                    className={`px-4 py-2 rounded-t-lg font-semibold transition-colors duration-200 ${activeTab === 'systems' ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    onClick={() => setActiveTab('systems')}
                >
                    Systems
                </button>
            </div>

            {/* Tab Content - Apply font-inter-only unconditionally */}
            <div className={`bg-transparent p-4 sm:p-6 rounded-b-xl rounded-tr-xl shadow-md border border-gray-700 font-inter-only`}>
                {activeTab === 'characterInfo' && (
                    <>
                        {/* Character Info */}
                        <div>
                            <h2 className="text-2xl font-semibold text-red-400 mb-4">Character Details</h2>
                            <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                                {/* Left Column: Name, Race, Class, Affinity */}
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full md:w-auto">
                                    <div>
                                        <label className="block text-red-400 text-sm font-bold mb-2">Name:</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={character.name}
                                            onChange={handleCharacterChange}
                                            className="shadow appearance-none border border-gray-600 rounded-lg w-full py-2 px-3 bg-gray-700 text-gray-100 leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-red-400 text-sm font-bold mb-2">Race:</label>
                                        <select
                                            name="race"
                                            value={character.race}
                                            onChange={handleCharacterChange}
                                            className="shadow border border-gray-600 rounded-lg w-full py-2 px-3 bg-gray-700 text-gray-100 leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                                        >
                                            {Object.keys(BASE_STATS.races).map(race => (
                                                <option key={race} value={race}>{race}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-red-400 text-sm font-bold mb-2">Class:</label>
                                        <select
                                            name="class"
                                            value={character.class}
                                            onChange={handleCharacterChange}
                                            className="shadow border border-gray-600 rounded-lg w-full py-2 px-3 bg-gray-700 text-gray-100 leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                                        >
                                            {Object.keys(BASE_STATS.classes).map(cls => (
                                                <option key={cls} value={cls}>{cls}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-red-400 text-sm font-bold mb-2">Affinity:</label>
                                        <select
                                            name="affinity"
                                            value={character.affinity}
                                            onChange={handleCharacterChange}
                                            className="shadow border border-gray-600 rounded-lg w-full py-2 px-3 bg-gray-700 text-gray-100 leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                                        >
                                            {Object.keys(BASE_STATS.affinities).map(aff => (
                                                <option key={aff} value={aff}>{aff}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Right Column: Character Portrait and Affinity Symbol */}
                                <div className="flex-shrink-0 flex flex-col items-center md:items-end w-full md:w-auto mt-6 md:mt-0">
                                    <label className="block text-red-400 text-sm font-bold mb-2">Character Portrait:</label>

                                    {/* Character Portrait Container (relative for absolute positioning of overlay) */}
                                    <div className="w-48 h-48 sm:w-64 sm:h-64 bg-gray-700 rounded-lg overflow-hidden border-2 border-red-500 flex items-center justify-center shadow-lg relative">
                                        <img
                                            src={character.portraitUrl}
                                            alt="Character Portrait"
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = "https://placehold.co/200x200/333/eee?text=Character";
                                                setPortraitLoadError(true); // Set error state
                                            }}
                                            onLoad={() => setPortraitLoadError(false)} // Clear error on successful load
                                        />
                                        {portraitLoadError && (
                                            <p className="absolute bottom-0 right-0 text-red-400 text-xs bg-gray-900 bg-opacity-75 p-1 rounded-bl-lg">Load Error</p>
                                        )}

                                        {/* Affinity Symbol Overlay */}
                                        <div className="absolute top-2 right-2 w-12 h-12 bg-white rounded-full overflow-hidden border-2 border-gray-300 flex items-center justify-center shadow-md z-10">
                                            {affinityOverlayUrl ? (
                                                <img
                                                    src={affinityOverlayUrl}
                                                    alt="Affinity Icon"
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        console.error("Affinity Debug: Affinity image failed to load:", e);
                                                        e.target.onerror = null;
                                                        e.target.src = "https://placehold.co/48x48/FFFFFF/333?text=AFF"; // Fallback image with white background
                                                        setAffinityOverlayLoadError(true);
                                                    }}
                                                    onLoad={() => setAffinityOverlayLoadError(false)}
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-xs text-gray-700 text-center p-1">
                                                    No Symbol
                                                </div>
                                            )}
                                            {affinityOverlayLoadError && (
                                                <p className="absolute bottom-0 right-0 text-red-400 text-xs bg-gray-900 bg-opacity-75 p-1 rounded-bl-lg">Load Error</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'statsXp' && (
                    <>
                        {/* Base Stats from Selections */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-semibold text-red-400 mb-4">Base Stats from Selections</h2>
                            <p className="text-red-300 mb-2">These are your foundational stats from your Race, Class, and Affinity, before any equipment bonuses.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg shadow border border-gray-600">
                                    <span className="text-red-300 font-medium">Max Life Essence:</span>
                                    <span className="text-lg font-bold text-red-300">{calculatedStats.baseLifeMax}</span>
                                </div>
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg shadow border border-gray-600">
                                    <span className="text-red-300 font-medium">Strength:</span>
                                    <span className="text-lg font-bold text-red-300">{calculatedStats.baseStrength}</span>
                                </div>
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg shadow border border-gray-600">
                                    <span className="text-red-300 font-medium">Agility:</span>
                                    <span className="text-lg font-bold text-red-300">{calculatedStats.baseAgility}</span>
                                </div>
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg shadow border border-gray-600">
                                    <span className="text-red-300 font-medium">Max Action Points:</span>
                                    <span className="text-lg font-bold text-red-300">{calculatedStats.baseApMax}</span>
                                </div>
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg shadow border border-gray-600">
                                    <span className="text-red-300 font-medium">Starting Gold:</span>
                                    <span className="text-lg font-bold text-yellow-300">{calculatedStats.baseGold}</span>
                                </div>
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg shadow border border-gray-600">
                                    <span className="text-red-300 font-medium">Base Attack Score:</span>
                                    <span className="text-lg font-bold text-orange-300">{calculatedStats.baseAttack}</span>
                                </div>
                            </div>
                        </div>

                        {/* Core Stats (Calculated with Equipment) */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-semibold text-red-400 mb-4">Current Stats (Including Equipment)</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {/* Life Essence */}
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg shadow border border-gray-600">
                                    <span className="text-red-300 font-medium">Life Essence:</span>
                                    <div className="flex items-center">
                                        <button onClick={() => handleIncrementDecrement('lifeCurrent', -1)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-2 rounded-full mr-2">-</button>
                                        <input
                                            type="number"
                                            value={character.life.current}
                                            onChange={(e) => handleStatInputChange('lifeCurrent', e.target.value)}
                                            className="w-20 text-center bg-gray-600 text-red-300 font-bold rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-red-500"
                                            min="0"
                                            max={calculatedStats.totalLifeMax}
                                        />
                                        <span className="text-red-400"> / {calculatedStats.totalLifeMax}</span>
                                        <button onClick={() => handleIncrementDecrement('lifeCurrent', 1)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-2 rounded-full ml-2">+</button>
                                    </div>
                                </div>
                                {/* Strength */}
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg shadow border border-gray-600">
                                    <span className="text-red-300 font-medium">Strength:</span>
                                    <span className="text-lg font-bold text-red-300">{calculatedStats.totalStrength}</span>
                                </div>
                                {/* Agility */}
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg shadow border border-gray-600">
                                    <span className="text-red-300 font-medium">Agility:</span>
                                    <span className="text-lg font-bold text-red-300">{calculatedStats.totalAgility}</span>
                                </div>
                                {/* Action Points */}
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg shadow border border-gray-600">
                                    <span className="text-red-300 font-medium">Action Points:</span>
                                    <div className="flex items-center">
                                        <button onClick={() => handleIncrementDecrement('apCurrent', -1)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-2 rounded-full mr-2">-</button>
                                        <input
                                            type="number"
                                            value={character.ap.current}
                                            onChange={(e) => handleStatInputChange('apCurrent', e.target.value)}
                                            className="w-20 text-center bg-gray-600 text-red-300 font-bold rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-red-500"
                                            min="0"
                                            max={calculatedStats.totalApMax}
                                        />
                                        <span className="text-red-400"> / {calculatedStats.totalApMax}</span>
                                        <button onClick={() => handleIncrementDecrement('apCurrent', 1)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-2 rounded-full ml-2">+</button>
                                    </div>
                                </div>
                                {/* Gold */}
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg shadow border border-gray-600">
                                    <span className="text-red-300 font-medium">Gold:</span>
                                    <div className="flex items-center">
                                        <button onClick={() => handleIncrementDecrement('gold', -1)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-2 rounded-full mr-2">-</button>
                                        <input
                                            type="number"
                                            value={character.gold}
                                            onChange={(e) => handleStatInputChange('gold', e.target.value)}
                                            className="w-20 text-center bg-gray-600 text-yellow-300 font-bold rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                                            min="0"
                                        />
                                        <button onClick={() => handleIncrementDecrement('gold', 1)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-2 rounded-full ml-2">+</button>
                                    </div>
                                </div>
                                {/* XP */}
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg shadow border border-gray-600">
                                    <span className="text-red-300 font-medium">XP:</span>
                                    <div className="flex items-center">
                                        <button onClick={() => handleIncrementDecrement('xp', -1)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-2 rounded-full mr-2">-</button>
                                        <input
                                            type="number"
                                            value={character.xp}
                                            onChange={(e) => handleStatInputChange('xp', e.target.value)}
                                            className="w-20 text-center bg-gray-600 text-blue-300 font-bold rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            min="0"
                                        />
                                        <button onClick={() => handleIncrementDecrement('xp', 1)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-2 rounded-full ml-2">+</button>
                                    </div>
                                </div>
                                {/* Doubt */}
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg shadow border border-gray-600">
                                    <span className="text-red-300 font-medium">Doubt:</span>
                                    <div className="flex items-center">
                                        <button onClick={() => handleIncrementDecrement('doubt', -1)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-2 rounded-full mr-2">-</button>
                                        <input
                                            type="number"
                                            value={character.doubt}
                                            onChange={(e) => handleStatInputChange('doubt', e.target.value)}
                                            className="w-20 text-center bg-gray-600 text-purple-300 font-bold rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                            min="0"
                                        />
                                        <button onClick={() => handleIncrementDecrement('doubt', 1)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-2 rounded-full ml-2">+</button>
                                    </div>
                                </div>
                                {/* Corruption */}
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg shadow border border-gray-600">
                                    <span className="text-red-300 font-medium">Corruption:</span>
                                    <div className="flex items-center">
                                        <button onClick={() => handleIncrementDecrement('corruption', -1)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-2 rounded-full mr-2">-</button>
                                        <input
                                            type="number"
                                            value={character.corruption}
                                            onChange={(e) => handleStatInputChange('corruption', e.target.value)}
                                            className="w-20 text-center bg-gray-600 text-red-500 font-bold rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-red-500"
                                            min="0"
                                        />
                                        <button onClick={() => handleIncrementDecrement('corruption', 1)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-2 rounded-full ml-2">+</button>
                                    </div>
                                </div>
                                {/* Aligned Card Attack Bonus */}
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg shadow border border-gray-600 col-span-full sm:col-span-1">
                                    <span className="text-red-300 font-medium">Aligned Card Attack Bonus:</span>
                                    <span className="text-lg font-bold text-orange-300">+{calculatedStats.alignedCardsAttackBonus}</span>
                                </div>
                                {/* Total Attack Score (Derived) */}
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg shadow border border-gray-600 col-span-full sm:col-span-1">
                                    <span className="text-red-300 font-medium">Total Attack Score:</span>
                                    <span className="text-lg font-bold text-orange-400">{calculatedStats.totalAttack}</span>
                                </div>
                            </div>
                        </div>

                        {/* XP Formula Calculator */}
                        <div>
                            <h2 className="text-2xl font-semibold text-red-400 mb-4">XP Formula Calculator</h2>
                            <p className="text-red-300 text-sm mb-2">
                                Enter a formula using variables: `lifeCurrent`, `lifeMax`, `strength`, `agility`, `apCurrent`, `apMax`, `gold`, `xp`, `doubt`, `corruption`, `attack`.
                            </p>
                            <input
                                type="text"
                                value={xpFormula}
                                onChange={(e) => setXpFormula(e.target.value)}
                                className="shadow appearance-none border border-gray-600 rounded-lg w-full py-2 px-3 bg-gray-700 text-gray-100 leading-tight focus:outline-none focus:ring-2 focus:ring-red-500 mb-3"
                                placeholder="e.g., gold / 2 + strength"
                            />
                            <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg shadow border border-gray-600">
                                <span className="text-red-300 font-medium">Calculated XP:</span>
                                {xpFormulaError ? (
                                    <span className="text-red-500 font-bold">{xpFormulaError}</span>
                                ) : (
                                    <span className="text-lg font-bold text-blue-300">{calculatedXpFromFormula}</span>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'equipment' && (
                    <>
                        {/* Equipment Slots */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-semibold text-red-400 mb-4">Equipped Items (Max 5)</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                                {character.equippedItems.map(item => (
                                    <div key={item.id} className="bg-gray-700 p-3 rounded-lg shadow border border-gray-600">
                                        <h3 className="text-red-300 font-semibold mb-2">Slot {item.id.replace('slot', '')}</h3>
                                        <div className="mb-2">
                                            <label className="block text-red-400 text-xs font-bold mb-1">Select Item:</label>
                                            <select
                                                value={item.ItemName || ''}
                                                onChange={(e) => handleEquippedItemChange(item.id, e.target.value)}
                                                className="shadow border border-gray-600 rounded-lg w-full py-1 px-2 bg-gray-600 text-gray-100 leading-tight focus:outline-none focus:ring-1 focus:ring-red-500 text-sm"
                                            >
                                                <option value="">-- Clear Slot --</option>
                                                {equipmentData.map(eqItem => (
                                                    <option key={eqItem.ItemName} value={eqItem.ItemName}>
                                                        {eqItem.ItemName} (Rank: {eqItem.Rank}, Affinity: {eqItem.Affinity})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="mb-2">
                                            <label className="block text-red-400 text-xs font-bold mb-1">Rank:</label>
                                            <input
                                                type="text"
                                                value={item.Rank || ''}
                                                readOnly // Make read-only as it's populated from CSV
                                                className="shadow appearance-none border border-gray-600 rounded-lg w-full py-1 px-2 bg-gray-600 text-gray-100 leading-tight focus:outline-none focus:ring-1 focus:ring-red-500 text-sm"
                                            />
                                        </div>
                                        <div className="mb-2">
                                            <label className="block text-red-400 text-xs font-bold mb-1">Affinity:</label>
                                            <input
                                                type="text"
                                                value={item.Affinity || ''}
                                                readOnly // Make read-only as it's populated from CSV
                                                className="shadow appearance-none border border-gray-600 rounded-lg w-full py-1 px-2 bg-gray-600 text-gray-100 leading-tight focus:outline-none focus:ring-1 focus:ring-red-500 text-sm"
                                            />
                                        </div>
                                        <div className="mb-2">
                                            <label className="block text-red-400 text-xs font-bold mb-1">Primary Effect:</label>
                                            <textarea
                                                value={item.PrimaryEffect || ''}
                                                readOnly // Make read-only as it's populated from CSV
                                                className="shadow appearance-none border border-gray-600 rounded-lg w-full py-1 px-2 bg-gray-600 text-gray-100 leading-tight focus:outline-none focus:ring-1 focus:ring-red-500 text-sm h-16"
                                            ></textarea>
                                        </div>
                                        {item.Rank && item.Affinity && item.Affinity === character.affinity && (
                                            <p className="text-green-400 text-xs mt-2">
                                                +1 {item.Affinity === 'Blood' || item.Affinity === 'Nature' ? 'Life Essence' : item.Affinity === 'Bone' ? 'Agility' : item.Affinity === 'Shadow' ? 'Action Point' : 'Strength'} (Affinity Match)
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="bg-gray-700 p-4 rounded-lg shadow border border-gray-600 mt-6">
                                <h3 className="text-xl font-semibold text-red-300 mb-2">Equipment Hand Bonus:</h3>
                                <p className="text-lg text-yellow-300">{calculatedStats.equipmentHandBonusText}</p>
                                {/* Display the currentEquipmentHandBonus which now holds the display name */}
                                {calculatedStats.currentEquipmentHandBonus !== "None" && calculatedStats.currentEquipmentHandBonus !== "Invalid or Incomplete Card Data" && (
                                    <p className="text-red-400 text-sm mt-1">
                                        Current Hand: {calculatedStats.currentEquipmentHandBonus}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Available Equipment List */}
                        <div className="mt-8">
                            <h2 className="text-2xl font-semibold text-red-400 mb-4">Available Equipment</h2>
                            <input
                                type="text"
                                value={equipmentSearchTerm}
                                onChange={handleEquipmentSearch}
                                className="shadow appearance-none border border-gray-600 rounded-lg w-full py-2 px-3 bg-gray-700 text-gray-100 leading-tight focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
                                placeholder="Search equipment by name, affinity, or effect..."
                            />
                            {isLoadingEquipmentCsv ? (
                                <p className="text-red-400">Loading equipment data...</p>
                            ) : equipmentCsvLoadError ? (
                                <p className="text-red-400">{equipmentCsvLoadError}</p>
                            ) : equipmentData.length === 0 ? (
                                <p className="text-yellow-400">No equipment data loaded. Please provide a valid CSV link in the Systems tab.</p>
                            ) : (
                                <div className="max-h-96 overflow-y-auto border border-gray-600 rounded-lg p-2 bg-gray-700">
                                    {filteredEquipmentData.length > 0 ? (
                                        <table className="min-w-full divide-y divide-gray-600">
                                            <thead className="bg-gray-700 sticky top-0">
                                                <tr>
                                                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                                        Item Name
                                                    </th>
                                                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                                        Rank
                                                    </th>
                                                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                                        Affinity
                                                    </th>
                                                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                                        Primary Effect
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-gray-800 divide-y divide-gray-700">
                                                {filteredEquipmentData.map((eqItem, index) => (
                                                    <tr key={index} className="hover:bg-gray-600 transition-colors duration-150">
                                                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-red-300">{eqItem.ItemName}</td>
                                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-red-300">{eqItem.Rank}</td>
                                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-red-300">{eqItem.Affinity}</td>
                                                        <td className="px-3 py-2 text-sm text-red-300">{eqItem.PrimaryEffect}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p className="text-yellow-400 text-center py-4">No equipment found matching your search criteria.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'aiInsights' && (
                    <>
                        {/* LLM Features */}
                        <div>
                            <h2 className="text-2xl font-semibold text-red-400 mb-4">AI-Powered Insights</h2>
                            <div className="flex flex-col sm:flex-row gap-4 mb-4">
                                <button
                                    onClick={generateLore}
                                    disabled={isLoadingLore}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoadingLore ? (
                                        <span className="flex items-center justify-center">
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                            Generating...
                                        </span>
                                    ) : (
                                        "✨ Generate Lore"
                                    )}
                                </button>
                                <button
                                    onClick={suggestPersonalQuest}
                                    disabled={isLoadingQuest}
                                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoadingQuest ? (
                                        <span className="flex items-center justify-center">
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                            Suggesting...
                                        </span>
                                    ) : (
                                        "✨ Suggest Personal Quest"
                                    )}
                                </button>
                            </div>
                            {loreText && (
                                <div className="bg-gray-700 p-3 rounded-lg shadow border border-gray-600 mb-4">
                                    <h3 className="text-lg font-semibold text-blue-300 mb-2">Character Lore:</h3>
                                    <p className="text-red-300 whitespace-pre-wrap">{loreText}</p>
                                </div>
                            )}
                            {questText && (
                                <div className="bg-gray-700 p-3 rounded-lg shadow border border-gray-600">
                                    <h3 className="text-lg font-semibold text-purple-300 mb-2">Personal Quest Idea:</h3>
                                    <p className="text-red-300 whitespace-pre-wrap">{questText}</p>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'gameGuide' && (
                    <>
                        <h2 className="text-2xl font-semibold text-red-400 mb-4">Grim Hand Game Guide</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                            <button
                                className={`book-button ${activeGuideSection === 'overview' ? 'active' : ''}`}
                                onClick={() => setActiveGuideSection('overview')}
                            >
                                Game Overview
                            </button>
                            <button
                                className={`book-button ${activeGuideSection === 'pokerHands' ? 'active' : ''}`}
                                onClick={() => setActiveGuideSection('pokerHands')}
                            >
                                Poker Hand Rankings
                            </button>
                            <button
                                className={`book-button ${activeGuideSection === 'equipmentBonuses' ? 'active' : ''}`}
                                onClick={() => setActiveGuideSection('equipmentBonuses')}
                            >
                                Equipment Hand Bonuses
                            </button>
                            <button
                                className={`book-button ${activeGuideSection === 'baseStats' ? 'active' : ''}`}
                                onClick={() => setActiveGuideSection('baseStats')}
                            >
                                Base Stats Reference
                            </button>
                            <button
                                className={`book-button ${activeGuideSection === 'fullInstructions' ? 'active' : ''}`}
                                onClick={() => setActiveGuideSection('fullInstructions')}
                            >
                                Full Game Instructions
                            </button>
                            <button
                                className={`book-button ${activeGuideSection === 'abilitiesQuests' ? 'active' : ''}`}
                                onClick={() => setActiveGuideSection('abilitiesQuests')}
                            >
                                Abilities & Quests
                            </button>
                        </div>

                        <div className="bg-gray-700 p-4 rounded-lg shadow border border-gray-600 text-red-300">
                            {activeGuideSection === 'overview' && (
                                <div>
                                    <h3 className="text-xl font-semibold text-red-400 mb-2">Game Overview & Core Concepts</h3>
                                    <p className="mb-2">Grim Hand combines strategic character building, exploration, and high-stakes poker-driven combat. Players embody characters forged by their Race, Class, and Affinity, seeking to complete Quests and gain Stature in a desolate world.</p>
                                    <ul className="list-disc list-inside space-y-1">
                                        <li><strong>The Grim Hand Deck:</strong> A standard 52-card poker deck forms the core of all card-based mechanics.</li>
                                        <li><strong>Life Essence:</strong> Your character's health. Dropping to 0 leads to defeat.</li>
                                        <li><strong>Primary Stats:</strong> Strength, Agility, Action Points (AP).</li>
                                        <li><strong>Resources:</strong> Gold (for items), XP (for abilities).</li>
                                        <li><strong>Negative Statuses:</strong> Doubt (mental strain), Corruption (insidious influence).</li>
                                        <li><strong>Affinity:</strong> (Blood, Bone, Shadow, Iron, Nature) grants bonuses, influences Quests, and provides benefits with matching cards.</li>
                                    </ul>
                                    <p className="mt-4 text-sm text-gray-400">For a more detailed overview, refer to the "Grim Hand: Comprehensive Game Summary" document.</p>
                                </div>
                            )}

                            {activeGuideSection === 'pokerHands' && (
                                <div>
                                    <h3 className="text-xl font-semibold text-red-400 mb-2">Poker Hand Rankings (Grim Hand Variant)</h3>
                                    <p className="mb-2">The strength of your poker hand determines various outcomes in Grim Hand, particularly in combat and for Equipment Hand Bonuses. Hands are ranked from lowest to highest:</p>
                                    <ol className="list-decimal list-inside space-y-1">
                                        {POKER_HAND_NAMES.map((hand, index) => (
                                            <li key={index}><strong>{hand}</strong> (Traditional Poker Equivalent: {
                                                index === 0 ? 'High Card' :
                                                index === 1 ? 'Pair' :
                                                index === 2 ? 'Two Pair' :
                                                index === 3 ? 'Three of a Kind' :
                                                index === 4 ? 'Straight' :
                                                index === 5 ? 'Flush' :
                                                index === 6 ? 'Full House' :
                                                index === 7 ? 'Four of a Kind' :
                                                index === 8 ? 'Straight Flush' :
                                                'Five of a Kind' // For index 9
                                            })</li>
                                        ))}
                                    </ol>
                                    <p className="mt-4 text-sm text-gray-400">In combat, your poker hand strength (level 0-9) can influence XP gain or other effects based on specific abilities.</p>
                                </div>
                            )}

                            {activeGuideSection === 'equipmentBonuses' && (
                                <div>
                                    <h3 className="text-xl font-semibold text-red-400 mb-2">Equipment Hand Bonuses</h3>
                                    <p className="mb-2">Forming specific poker hands with the Ranks of your **5 Equipped Item/Equipment Cards** grants powerful passive bonuses. Only the bonus for the **highest-ranking hand** applies.</p>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-600">
                                            <thead className="bg-gray-600">
                                                <tr>
                                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase tracking-wider">
                                                        Hand Type
                                                    </th>
                                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase tracking-wider">
                                                        Bonus
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-gray-700 divide-y divide-gray-600">
                                                {Object.entries(EQUIPMENT_HAND_BONUSES).map(([handName, data]) => (
                                                    <tr key={handName}>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-yellow-300">
                                                            {POKER_HAND_NAMES[POKER_HAND_NAMES.findIndex(name => name.includes(handName.replace(/ /g, '')))] || handName}
                                                        </td>
                                                        <td className="px-4 py-2 text-sm text-red-300">
                                                            {data.text}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="mt-4 text-sm text-gray-400">These bonuses are automatically applied to your "Current Stats" on the character sheet.</p>
                                </div>
                            )}

                            {activeGuideSection === 'baseStats' && (
                                <div>
                                    <h3 className="text-xl font-semibold text-red-400 mb-2">Base Stats Reference</h3>
                                    <p className="mb-2">Your foundational stats are determined by the combination of your chosen Race, Class, and Affinity.</p>

                                    <h4 className="text-lg font-semibold text-red-300 mt-4 mb-2">Races:</h4>
                                    <div className="overflow-x-auto mb-4">
                                        <table className="min-w-full divide-y divide-gray-600">
                                            <thead className="bg-gray-600">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">Race</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">Life</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">Str</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">Agi</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">AP</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">Gold</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">Attack Contrib.</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-gray-700 divide-y divide-gray-600">
                                                {Object.entries(BASE_STATS.races).map(([name, stats]) => (
                                                    <tr key={name}>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-yellow-300">{name}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-300">{stats.life}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-300">{stats.strength}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-300">{stats.agility}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-300">{stats.ap}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-300">{stats.gold}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-300">{stats.attackContribution}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <h4 className="text-lg font-semibold text-red-300 mt-4 mb-2">Classes:</h4>
                                    <div className="overflow-x-auto mb-4">
                                        <table className="min-w-full divide-y divide-gray-600">
                                            <thead className="bg-gray-600">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">Class</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">Life</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">Str</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">Agi</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">AP</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">Gold</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">Attack Contrib.</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-gray-700 divide-y divide-gray-600">
                                                {Object.entries(BASE_STATS.classes).map(([name, stats]) => (
                                                    <tr key={name}>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-yellow-300">{name}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-300">{stats.life}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-300">{stats.strength}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-300">{stats.agility}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-300">{stats.ap}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-300">{stats.gold}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-300">{stats.attackContribution}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <h4 className="text-lg font-semibold text-red-300 mt-4 mb-2">Affinities:</h4>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-600">
                                            <thead className="bg-gray-600">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">Affinity</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">Life</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">Str</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">Agi</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">AP</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">Gold</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase">Attack Contrib.</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-gray-700 divide-y divide-gray-600">
                                                {Object.entries(BASE_STATS.affinities).map(([name, stats]) => (
                                                    <tr key={name}>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-yellow-300">{name}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-300">{stats.life}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-300">{stats.strength}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-300">{stats.agility}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-300">{stats.ap}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-300">{stats.gold}</td>
                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-300">{stats.attackContribution}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="mt-4 text-sm text-gray-400">These values are automatically summed and displayed under "Base Stats from Selections" in the Stats & XP tab.</p>
                                </div>
                            )}

                            {activeGuideSection === 'fullInstructions' && (
                                <div>
                                    <h3 className="text-xl font-semibold text-red-400 mb-2">Full Game Instructions</h3>
                                    <p className="mb-2">The complete game instructions are extensive and are best viewed in their dedicated document.</p>
                                    <p className="text-sm text-gray-400">Please refer to the "Grim Hand: Complete Game Instructions" document for full details on game setup, phases, and core mechanics.</p>
                                </div>
                            )}

                            {activeGuideSection === 'abilitiesQuests' && (
                                <div>
                                    <h3 className="text-xl font-semibold text-red-400 mb-2">Abilities & Quests</h3>
                                    <p className="mb-2">Grim Hand features a wide array of unique abilities and quests that define your character's journey.</p>
                                    <p className="text-sm text-gray-400">
                                        For detailed information on Stature Abilities (Novice, Adept, Veteran, Master, Legendary) and Quest Cards, please refer to the following separate documents:
                                    </p>
                                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-gray-400">
                                        <li>"Blood Affinity Ability Reference Sheet" (and similar for other affinities)</li>
                                        <li>"Grim Hand Ability Names by Stature"</li>
                                        <li>"Grim Hand Abilities with Novice Effects Defined"</li>
                                        <li>"Grim Hand Quest Cards" (for both "quest_cards_table" and "quest_cards_full_table")</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'systems' && (
                    <>
                        {/* Master Data Source Input */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-semibold text-red-400 mb-4">Master Data Source Link</h2>
                            <p className="text-red-300 text-sm mb-3">
                                Paste the Google Sheets CSV published link for your **Master Links table** below. This sheet should contain a `Type` column (e.g., "CharacterImages", "EquipmentData", "AffinityData") and a `Link` column with the corresponding CSV URLs for your other data sheets.
                            </p>
                            <input
                                type="text"
                                value={masterCsvLink}
                                onChange={(e) => setMasterCsvLink(e.target.value)}
                                className="shadow appearance-none border border-gray-600 rounded-lg w-full py-2 px-3 bg-gray-700 text-gray-100 leading-tight focus:outline-none focus:ring-2 focus:ring-red-500 mb-3"
                                placeholder="e.g., https://docs.google.com/spreadsheets/d/e/2PACX-1vR_your_master_sheet_id_here/pub?output=csv"
                            />
                            <button
                                onClick={loadMasterData}
                                disabled={isLoadingMasterCsv}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed w-full"
                                >
                                {isLoadingMasterCsv ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Loading All Data...
                                    </span>
                                ) : (
                                    "Load All Data from Master CSV"
                                )}
                            </button>
                            {masterCsvLoadError && (
                                <p className="text-red-400 text-sm mt-2">{masterCsvLoadError}</p>
                            )}
                            {!isLoadingMasterCsv && masterCsvLink && !masterCsvLoadError && masterData.length === 0 && (
                                <p className="text-yellow-400 text-sm mt-2">Master CSV loaded, but no entries found. Ensure 'Type' and 'Link' columns are present and populated.</p>
                            )}
                            {masterData.length > 0 && !masterCsvLoadError && !isLoadingMasterCsv && (
                                <p className="text-green-400 text-sm mt-2">Successfully loaded {masterData.length} entries from Master CSV.</p>
                            )}
                        </div>

                        {/* Individual Data Load Status (from Master) */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-semibold text-red-400 mb-4">Individual Data Load Status</h2>
                            <div className="bg-gray-700 p-3 rounded-lg shadow border border-gray-600 mb-2">
                                <p className="text-red-300 font-medium">Character Images:</p>
                                {isLoadingCharacterCsv ? (
                                    <p className="text-red-400 text-sm">Loading...</p>
                                ) : characterCsvLoadError ? (
                                    <p className="text-red-400 text-sm">{characterCsvLoadError}</p>
                                ) : characterImageData.length > 0 ? (
                                    <p className="text-green-400 text-sm">Loaded {characterImageData.length} entries.</p>
                                ) : (
                                    <p className="text-yellow-400 text-sm">No data loaded.</p>
                                )}
                            </div>
                            <div className="bg-gray-700 p-3 rounded-lg shadow border border-gray-600 mb-2">
                                <p className="text-red-300 font-medium">Equipment Data:</p>
                                {isLoadingEquipmentCsv ? (
                                    <p className="text-red-400 text-sm">Loading...</p>
                                ) : equipmentCsvLoadError ? (
                                    <p className="text-red-400 text-sm">{equipmentCsvLoadError}</p>
                                ) : equipmentData.length > 0 ? (
                                    <p className="text-green-400 text-sm">Loaded {equipmentData.length} entries.</p>
                                ) : (
                                    <p className="text-yellow-400 text-sm">No data loaded.</p>
                                )}
                            </div>
                            {/* New: Affinity Data Load Status */}
                            <div className="bg-gray-700 p-3 rounded-lg shadow border border-gray-600">
                                <p className="text-red-300 font-medium">Affinity Data:</p>
                                {isLoadingAffinityCsv ? (
                                    <p className="text-red-400 text-sm">Loading...</p>
                                ) : affinityCsvLoadError ? (
                                    <p className="text-red-400 text-sm">{affinityCsvLoadError}</p>
                                ) : affinityImageData.length > 0 ? (
                                    <p className="text-green-400 text-sm">Loaded {affinityImageData.length} entries.</p>
                                ) : (
                                    <p className="text-yellow-400 text-sm">No data loaded.</p>
                                )}
                            </div>
                        </div>

                        {/* Background Image URL Input */}
                        <div className="mb-8">
                            <h2 className="2xl font-semibold text-red-400 mb-4">Background Image URL</h2>
                            <p className="text-red-300 text-sm mb-3">
                                Paste a direct image URL here to use it as the application background.
                            </p>
                            <input
                                type="text"
                                value={backgroundImageUrl}
                                onChange={(e) => setBackgroundImageUrl(e.target.value)}
                                className="shadow appearance-none border border-gray-600 rounded-lg w-full py-2 px-3 bg-gray-700 text-gray-100 leading-tight focus:outline-none focus:ring-2 focus:ring-red-500 mb-3"
                                placeholder="e.g., https://example.com/your-background.jpg"
                            />
                            {backgroundImageUrl && (
                                <p className="text-green-400 text-sm mt-2">Background image set. Reload the preview if it doesn't appear immediately.</p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default App;
