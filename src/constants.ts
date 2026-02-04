import { NewsItem, GameVersion } from './types';

export const CURRENT_VERSION: GameVersion = {
  version: "1.2.0",
  size: "14.5 GB",
  downloadSizeMB: 4500 // 4.5GB
};

export const BACKGROUND_IMAGES = [
  "https://picsum.photos/id/122/1920/1080", // City night
  "https://picsum.photos/id/184/1920/1080", // Desert
  "https://picsum.photos/id/204/1920/1080", // Rail
  "https://picsum.photos/id/16/1920/1080", // Nature
];

export const NEWS_ITEMS: NewsItem[] = [
  {
    id: '1',
    title: "Version 1.2 'Echoes of the Void' Now Available",
    category: 'INFO',
    date: '2024-05-22',
    image: 'https://picsum.photos/id/237/600/300',
    content: `Greetings, Travelers!

We are thrilled to announce that Version 1.2 "Echoes of the Void" is now live! This update brings a massive expansion to the Aetheria map, introducing the mysterious Voidlands region.

**Update Highlights:**

1. **New Region: The Voidlands**
   Explore the dark, crystalline landscapes of the Voidlands. Encounter new enemies, solve ancient puzzles, and uncover the secrets of the lost civilization that once thrived here.

2. **New Story Quest: "Whispers in the Dark"**
   Continue your journey as the protagonist delves deeper into the mysteries of the Aether. Join forces with new allies to stop the encroaching darkness.

3. **New Features:**
   - Guild System overhaul: Create and manage your guild with improved tools.
   - New Raid: "The Crystal Spire" - A 12-player raid offering top-tier rewards.
   - Performance improvements and bug fixes.

Download the update now and begin your new adventure!`
  },
  {
    id: '2',
    title: "Maintenance Notice: Server Upgrade scheduled for June 1st",
    category: 'NOTICE',
    date: '2024-05-20',
    image: 'https://picsum.photos/id/134/600/300',
    content: `Dear Players,

To ensure the stability and performance of our servers, we will be performing a scheduled maintenance and server upgrade on June 1st, 2024.

**Maintenance Schedule:**
June 1st, 2024, from 02:00 to 06:00 (UTC).

**Details:**
During this time, the game servers will be unavailable. Please log out before the maintenance begins to avoid any data loss.

**Compensation:**
All players will receive 300 Aether Stones via in-game mail after the maintenance is complete.

Thank you for your understanding and support.`
  },
  {
    id: '3',
    title: "New Character 'Zephyr' Banner Rate-Up",
    category: 'EVENT',
    date: '2024-05-18',
    image: 'https://picsum.photos/id/338/600/300',
    content: `The wind whispers a new name...

The limited-time event wish "Gale of the West" is about to begin! During this event, the event-exclusive 5-star character "Zephyr" (Anemo) will receive a huge drop-rate boost!

**Event Duration:**
2024-05-18 18:00:00 - 2024-06-08 14:59:59

**Character Overview:**
Zephyr is a high-mobility DPS character who uses the power of the wind to control the battlefield. His elemental burst creates a vortex that pulls in enemies, dealing massive AoE damage.

Don't miss this chance to add Zephyr to your party!`
  },
  {
    id: '4',
    title: "Developer Note: Addressing recent performance issues",
    category: 'INFO',
    date: '2024-05-15',
    image: 'https://picsum.photos/id/445/600/300',
    content: `Hello everyone,

We have received feedback regarding frame rate drops in the "Neon City" area introduced in the previous patch. Our team has been working around the clock to identify the cause.

**Optimization Plan:**
We have identified a memory leak issue related to the dynamic lighting system in that specific zone. A hotfix (Patch 1.2.1) will be deployed later this week to resolve this.

We apologize for the inconvenience and appreciate your patience. A compensation package has been sent to your in-game mail.

Happy gaming!
- The Aetheria Dev Team`
  }
];

export const SOCIAL_LINKS = [
  { name: 'Discord', icon: 'message-circle' },
  { name: 'Twitter', icon: 'twitter' },
  { name: 'YouTube', icon: 'youtube' },
  { name: 'Web', icon: 'globe' },
];