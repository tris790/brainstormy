import { describe, it, expect, beforeAll } from 'vitest';
import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';
import type { BrainstormNode, BrainstormEdge } from '../types';
import { findParentForNewNode, cosineSimilarity } from './semantic';

// Real embedding model for accurate semantic tests
let extractor: FeatureExtractionPipeline;

async function getEmbedding(text: string): Promise<number[]> {
  const output = await extractor(text, {
    pooling: 'mean',
    normalize: true,
  });
  return Array.from(output.data as Float32Array);
}

// Helper to create a node with embedding
async function createNode(
  id: string,
  label: string,
  parentId?: string
): Promise<BrainstormNode> {
  const vector = await getEmbedding(label);
  return {
    id,
    type: 'satellite',
    position: { x: 0, y: 0 },
    data: {
      label,
      topic: label,
      color: '#000',
      vector,
      parentId,
      isAnchor: !parentId,
      createdAt: Date.now(),
    },
  };
}

// Helper to create edge
function createEdge(source: string, target: string): BrainstormEdge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    type: 'smoothstep',
  };
}

describe('Domain-specific Graph Building Tests', () => {
  beforeAll(async () => {
    // Load real embedding model
    extractor = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }, 60000); // 60 second timeout for model loading

  describe('Music/Instruments Domain', () => {
    /**
     * Tests graph building with music-related concepts
     *
     * Expected structure:
     * brainstorm
     *   └── music
     *         ├── guitar
     *         ├── drums
     *         └── piano
     *   └── sports (unrelated - should stay separate)
     *
     * When adding "strings", it should go under guitar (not sports)
     * When adding "rhythm", it should go under drums (not unrelated clusters)
     */
    it('should place guitar strings under guitar, not sports', async () => {
      const nodes: BrainstormNode[] = [];
      const edges: BrainstormEdge[] = [];

      const root = await createNode('root', 'brainstorm');
      root.data.isAnchor = true;
      nodes.push(root);

      // Music cluster
      const music = await createNode('music', 'music', 'root');
      music.data.isAnchor = true;
      nodes.push(music);
      edges.push(createEdge('root', 'music'));

      const guitar = await createNode('guitar', 'guitar', 'music');
      nodes.push(guitar);
      edges.push(createEdge('music', 'guitar'));

      // Sports cluster (unrelated)
      const sports = await createNode('sports', 'sports', 'root');
      sports.data.isAnchor = true;
      nodes.push(sports);
      edges.push(createEdge('root', 'sports'));

      const basketball = await createNode('basketball', 'basketball', 'sports');
      nodes.push(basketball);
      edges.push(createEdge('sports', 'basketball'));

      // Add "strings" - should go to guitar
      const stringsVector = await getEmbedding('strings');
      const parentNode = findParentForNewNode(stringsVector, nodes, edges);

      console.log('\n=== MUSIC DOMAIN: strings ===');
      console.log('strings parent:', parentNode?.data.label);

      // Verify semantic relationships
      const stringsToGuitar = cosineSimilarity(stringsVector, guitar.data.vector!);
      const stringsToSports = cosineSimilarity(stringsVector, sports.data.vector!);
      console.log('strings <-> guitar:', stringsToGuitar);
      console.log('strings <-> sports:', stringsToSports);

      // Strings should be closer to guitar than sports
      expect(stringsToGuitar).toBeGreaterThan(stringsToSports);
      // Parent should be music-related
      expect(
        parentNode?.data.label === 'guitar' ||
        parentNode?.data.label === 'music'
      ).toBe(true);
    });

    it('should place melody under music, not completely unrelated clusters', async () => {
      const nodes: BrainstormNode[] = [];
      const edges: BrainstormEdge[] = [];

      const root = await createNode('root', 'brainstorm');
      root.data.isAnchor = true;
      nodes.push(root);

      // Music cluster with instruments
      const music = await createNode('music', 'music', 'root');
      music.data.isAnchor = true;
      nodes.push(music);
      edges.push(createEdge('root', 'music'));

      const piano = await createNode('piano', 'piano', 'music');
      nodes.push(piano);
      edges.push(createEdge('music', 'piano'));

      const drums = await createNode('drums', 'drums', 'music');
      nodes.push(drums);
      edges.push(createEdge('music', 'drums'));

      // Technology cluster (unrelated)
      const tech = await createNode('tech', 'technology', 'root');
      tech.data.isAnchor = true;
      nodes.push(tech);
      edges.push(createEdge('root', 'tech'));

      const computer = await createNode('computer', 'computer', 'tech');
      nodes.push(computer);
      edges.push(createEdge('tech', 'computer'));

      // Add "melody" - should go to music cluster
      const melodyVector = await getEmbedding('melody');
      const parentNode = findParentForNewNode(melodyVector, nodes, edges);

      console.log('\n=== MUSIC DOMAIN: melody ===');
      console.log('melody parent:', parentNode?.data.label);

      const melodyToMusic = cosineSimilarity(melodyVector, music.data.vector!);
      const melodyToTech = cosineSimilarity(melodyVector, tech.data.vector!);
      console.log('melody <-> music:', melodyToMusic);
      console.log('melody <-> technology:', melodyToTech);

      expect(melodyToMusic).toBeGreaterThan(melodyToTech);
      expect(
        parentNode?.data.label === 'music' ||
        parentNode?.data.label === 'piano' ||
        parentNode?.data.label === 'drums'
      ).toBe(true);
    });

    it('should verify music terms are semantically related', async () => {
      const guitarVec = await getEmbedding('guitar');
      const pianoVec = await getEmbedding('piano');
      const drumsVec = await getEmbedding('drums');
      const musicVec = await getEmbedding('music');
      const sportsVec = await getEmbedding('sports');

      console.log('\n=== MUSIC SEMANTIC SIMILARITY ===');
      console.log('guitar <-> music:', cosineSimilarity(guitarVec, musicVec));
      console.log('piano <-> music:', cosineSimilarity(pianoVec, musicVec));
      console.log('drums <-> music:', cosineSimilarity(drumsVec, musicVec));
      console.log('guitar <-> piano:', cosineSimilarity(guitarVec, pianoVec));
      console.log('guitar <-> sports:', cosineSimilarity(guitarVec, sportsVec));

      // Instruments should be more similar to music than sports
      expect(cosineSimilarity(guitarVec, musicVec)).toBeGreaterThan(
        cosineSimilarity(guitarVec, sportsVec)
      );
    });
  });

  describe('Food/Cooking Domain', () => {
    /**
     * Tests graph building with food and cooking concepts
     *
     * Expected structure:
     * brainstorm
     *   └── cooking
     *         ├── baking
     *         │     └── flour
     *         │     └── oven
     *         └── grilling
     *   └── vehicles (unrelated)
     *
     * When adding "bread", it should go under baking (not vehicles)
     * When adding "recipe", it should go under cooking (not unrelated)
     */
    it('should place bread under baking, not vehicles', async () => {
      const nodes: BrainstormNode[] = [];
      const edges: BrainstormEdge[] = [];

      const root = await createNode('root', 'brainstorm');
      root.data.isAnchor = true;
      nodes.push(root);

      // Cooking cluster
      const cooking = await createNode('cooking', 'cooking', 'root');
      cooking.data.isAnchor = true;
      nodes.push(cooking);
      edges.push(createEdge('root', 'cooking'));

      const baking = await createNode('baking', 'baking', 'cooking');
      nodes.push(baking);
      edges.push(createEdge('cooking', 'baking'));

      const flour = await createNode('flour', 'flour', 'baking');
      nodes.push(flour);
      edges.push(createEdge('baking', 'flour'));

      // Vehicles cluster (unrelated)
      const vehicles = await createNode('vehicles', 'vehicles', 'root');
      vehicles.data.isAnchor = true;
      nodes.push(vehicles);
      edges.push(createEdge('root', 'vehicles'));

      const car = await createNode('car', 'car', 'vehicles');
      nodes.push(car);
      edges.push(createEdge('vehicles', 'car'));

      // Add "bread" - should go to baking cluster
      const breadVector = await getEmbedding('bread');
      const parentNode = findParentForNewNode(breadVector, nodes, edges);

      console.log('\n=== FOOD DOMAIN: bread ===');
      console.log('bread parent:', parentNode?.data.label);

      const breadToBaking = cosineSimilarity(breadVector, baking.data.vector!);
      const breadToVehicles = cosineSimilarity(breadVector, vehicles.data.vector!);
      console.log('bread <-> baking:', breadToBaking);
      console.log('bread <-> vehicles:', breadToVehicles);

      expect(breadToBaking).toBeGreaterThan(breadToVehicles);
      expect(
        parentNode?.data.label === 'baking' ||
        parentNode?.data.label === 'cooking' ||
        parentNode?.data.label === 'flour'
      ).toBe(true);
    });

    it('should place knife under cooking when kitchen context exists', async () => {
      const nodes: BrainstormNode[] = [];
      const edges: BrainstormEdge[] = [];

      const root = await createNode('root', 'brainstorm');
      root.data.isAnchor = true;
      nodes.push(root);

      // Kitchen/cooking cluster
      const cooking = await createNode('cooking', 'cooking', 'root');
      cooking.data.isAnchor = true;
      nodes.push(cooking);
      edges.push(createEdge('root', 'cooking'));

      const kitchen = await createNode('kitchen', 'kitchen', 'cooking');
      nodes.push(kitchen);
      edges.push(createEdge('cooking', 'kitchen'));

      const cutting = await createNode('cutting', 'cutting board', 'kitchen');
      nodes.push(cutting);
      edges.push(createEdge('kitchen', 'cutting'));

      // Add "knife" - should go to cooking/kitchen context
      const knifeVector = await getEmbedding('knife');
      const parentNode = findParentForNewNode(knifeVector, nodes, edges);

      console.log('\n=== FOOD DOMAIN: knife ===');
      console.log('knife parent:', parentNode?.data.label);

      // Knife should be related to kitchen/cooking
      const knifeToCooking = cosineSimilarity(knifeVector, cooking.data.vector!);
      const knifeToKitchen = cosineSimilarity(knifeVector, kitchen.data.vector!);
      console.log('knife <-> cooking:', knifeToCooking);
      console.log('knife <-> kitchen:', knifeToKitchen);

      expect(
        parentNode?.data.label === 'cooking' ||
        parentNode?.data.label === 'kitchen' ||
        parentNode?.data.label === 'cutting board'
      ).toBe(true);
    });

    it('should verify food/cooking terms are semantically related', async () => {
      const bakingVec = await getEmbedding('baking');
      const breadVec = await getEmbedding('bread');
      const ovenVec = await getEmbedding('oven');
      const cookingVec = await getEmbedding('cooking');
      const vehiclesVec = await getEmbedding('vehicles');

      console.log('\n=== FOOD SEMANTIC SIMILARITY ===');
      console.log('baking <-> cooking:', cosineSimilarity(bakingVec, cookingVec));
      console.log('bread <-> baking:', cosineSimilarity(breadVec, bakingVec));
      console.log('oven <-> baking:', cosineSimilarity(ovenVec, bakingVec));
      console.log('baking <-> vehicles:', cosineSimilarity(bakingVec, vehiclesVec));

      // Baking should be more related to cooking than vehicles
      expect(cosineSimilarity(bakingVec, cookingVec)).toBeGreaterThan(
        cosineSimilarity(bakingVec, vehiclesVec)
      );
    });
  });

  describe('Sports/Equipment Domain', () => {
    /**
     * Tests graph building with sports concepts
     *
     * Expected structure:
     * brainstorm
     *   └── basketball
     *         ├── hoop
     *         └── court
     *   └── swimming
     *         └── pool
     *   └── weather (unrelated)
     *
     * When adding "dribble", it should go under basketball (not swimming)
     * When adding "goggles", it could go to swimming
     */
    it('should place basketball court under basketball, not swimming', async () => {
      const nodes: BrainstormNode[] = [];
      const edges: BrainstormEdge[] = [];

      const root = await createNode('root', 'brainstorm');
      root.data.isAnchor = true;
      nodes.push(root);

      // Basketball cluster
      const basketball = await createNode('basketball', 'basketball', 'root');
      basketball.data.isAnchor = true;
      nodes.push(basketball);
      edges.push(createEdge('root', 'basketball'));

      const hoop = await createNode('hoop', 'hoop', 'basketball');
      nodes.push(hoop);
      edges.push(createEdge('basketball', 'hoop'));

      // Swimming cluster
      const swimming = await createNode('swimming', 'swimming', 'root');
      swimming.data.isAnchor = true;
      nodes.push(swimming);
      edges.push(createEdge('root', 'swimming'));

      const pool = await createNode('pool', 'pool', 'swimming');
      nodes.push(pool);
      edges.push(createEdge('swimming', 'pool'));

      // Add "basketball court" - should go to basketball
      const courtVector = await getEmbedding('basketball court');
      const parentNode = findParentForNewNode(courtVector, nodes, edges);

      console.log('\n=== SPORTS DOMAIN: basketball court ===');
      console.log('basketball court parent:', parentNode?.data.label);

      const courtToBasketball = cosineSimilarity(courtVector, basketball.data.vector!);
      const courtToSwimming = cosineSimilarity(courtVector, swimming.data.vector!);
      console.log('basketball court <-> basketball:', courtToBasketball);
      console.log('basketball court <-> swimming:', courtToSwimming);

      expect(courtToBasketball).toBeGreaterThan(courtToSwimming);
      expect(
        parentNode?.data.label === 'basketball' ||
        parentNode?.data.label === 'hoop'
      ).toBe(true);
    });

    it('should place goggles under swimming when swim context exists', async () => {
      const nodes: BrainstormNode[] = [];
      const edges: BrainstormEdge[] = [];

      const root = await createNode('root', 'brainstorm');
      root.data.isAnchor = true;
      nodes.push(root);

      // Swimming cluster
      const swimming = await createNode('swimming', 'swimming', 'root');
      swimming.data.isAnchor = true;
      nodes.push(swimming);
      edges.push(createEdge('root', 'swimming'));

      const pool = await createNode('pool', 'pool', 'swimming');
      nodes.push(pool);
      edges.push(createEdge('swimming', 'pool'));

      const diving = await createNode('diving', 'diving', 'swimming');
      nodes.push(diving);
      edges.push(createEdge('swimming', 'diving'));

      // Weather cluster (unrelated)
      const weather = await createNode('weather', 'weather', 'root');
      weather.data.isAnchor = true;
      nodes.push(weather);
      edges.push(createEdge('root', 'weather'));

      const rain = await createNode('rain', 'rain', 'weather');
      nodes.push(rain);
      edges.push(createEdge('weather', 'rain'));

      // Add "goggles" - should go to swimming
      const gogglesVector = await getEmbedding('goggles');
      const parentNode = findParentForNewNode(gogglesVector, nodes, edges);

      console.log('\n=== SPORTS DOMAIN: goggles ===');
      console.log('goggles parent:', parentNode?.data.label);

      const gogglesToSwimming = cosineSimilarity(gogglesVector, swimming.data.vector!);
      const gogglesToWeather = cosineSimilarity(gogglesVector, weather.data.vector!);
      console.log('goggles <-> swimming:', gogglesToSwimming);
      console.log('goggles <-> weather:', gogglesToWeather);

      expect(gogglesToSwimming).toBeGreaterThan(gogglesToWeather);
      expect(
        parentNode?.data.label === 'swimming' ||
        parentNode?.data.label === 'pool' ||
        parentNode?.data.label === 'diving'
      ).toBe(true);
    });

    it('should place referee near sports, not unrelated domains', async () => {
      const nodes: BrainstormNode[] = [];
      const edges: BrainstormEdge[] = [];

      const root = await createNode('root', 'brainstorm');
      root.data.isAnchor = true;
      nodes.push(root);

      // Soccer cluster
      const soccer = await createNode('soccer', 'soccer', 'root');
      soccer.data.isAnchor = true;
      nodes.push(soccer);
      edges.push(createEdge('root', 'soccer'));

      const ball = await createNode('ball', 'ball', 'soccer');
      nodes.push(ball);
      edges.push(createEdge('soccer', 'ball'));

      const goal = await createNode('goal', 'goal', 'soccer');
      nodes.push(goal);
      edges.push(createEdge('soccer', 'goal'));

      // Gardening cluster (unrelated)
      const gardening = await createNode('gardening', 'gardening', 'root');
      gardening.data.isAnchor = true;
      nodes.push(gardening);
      edges.push(createEdge('root', 'gardening'));

      const flowers = await createNode('flowers', 'flowers', 'gardening');
      nodes.push(flowers);
      edges.push(createEdge('gardening', 'flowers'));

      // Add "referee" - should go to soccer
      const refereeVector = await getEmbedding('referee');
      const parentNode = findParentForNewNode(refereeVector, nodes, edges);

      console.log('\n=== SPORTS DOMAIN: referee ===');
      console.log('referee parent:', parentNode?.data.label);

      const refereeToSoccer = cosineSimilarity(refereeVector, soccer.data.vector!);
      const refereeToGardening = cosineSimilarity(refereeVector, gardening.data.vector!);
      console.log('referee <-> soccer:', refereeToSoccer);
      console.log('referee <-> gardening:', refereeToGardening);

      expect(refereeToSoccer).toBeGreaterThan(refereeToGardening);
      expect(
        parentNode?.data.label === 'soccer' ||
        parentNode?.data.label === 'ball' ||
        parentNode?.data.label === 'goal'
      ).toBe(true);
    });

    it('should verify sports terms are semantically related', async () => {
      const basketballVec = await getEmbedding('basketball');
      const hoopVec = await getEmbedding('hoop');
      const dribbleVec = await getEmbedding('dribble');
      const swimmingVec = await getEmbedding('swimming');
      const weatherVec = await getEmbedding('weather');

      console.log('\n=== SPORTS SEMANTIC SIMILARITY ===');
      console.log('basketball <-> hoop:', cosineSimilarity(basketballVec, hoopVec));
      console.log('basketball <-> dribble:', cosineSimilarity(basketballVec, dribbleVec));
      console.log('basketball <-> swimming:', cosineSimilarity(basketballVec, swimmingVec));
      console.log('basketball <-> weather:', cosineSimilarity(basketballVec, weatherVec));

      // Basketball should be more related to hoop than weather
      expect(cosineSimilarity(basketballVec, hoopVec)).toBeGreaterThan(
        cosineSimilarity(basketballVec, weatherVec)
      );
    });
  });

  describe('Cross-domain Discrimination', () => {
    /**
     * Tests that concepts from different domains don't accidentally merge
     */
    it('should keep music and sports separate even with similar-sounding terms', async () => {
      const nodes: BrainstormNode[] = [];
      const edges: BrainstormEdge[] = [];

      const root = await createNode('root', 'brainstorm');
      root.data.isAnchor = true;
      nodes.push(root);

      // Music cluster
      const music = await createNode('music', 'music', 'root');
      music.data.isAnchor = true;
      nodes.push(music);
      edges.push(createEdge('root', 'music'));

      const band = await createNode('band', 'band', 'music');
      nodes.push(band);
      edges.push(createEdge('music', 'band'));

      // Sports cluster
      const sports = await createNode('sports', 'sports', 'root');
      sports.data.isAnchor = true;
      nodes.push(sports);
      edges.push(createEdge('root', 'sports'));

      const team = await createNode('team', 'team', 'sports');
      nodes.push(team);
      edges.push(createEdge('sports', 'team'));

      // Add "concert" - should go to music, not sports
      const concertVector = await getEmbedding('concert');
      const concertParent = findParentForNewNode(concertVector, nodes, edges);

      console.log('\n=== CROSS-DOMAIN: concert ===');
      console.log('concert parent:', concertParent?.data.label);

      // Add "stadium" - could go to either, but more sports-related
      const stadiumVector = await getEmbedding('stadium');
      const stadiumParent = findParentForNewNode(stadiumVector, nodes, edges);

      console.log('stadium parent:', stadiumParent?.data.label);

      // Concert should be music-related
      expect(
        concertParent?.data.label === 'music' ||
        concertParent?.data.label === 'band'
      ).toBe(true);
    });

    it('should keep cooking and chemistry separate', async () => {
      const nodes: BrainstormNode[] = [];
      const edges: BrainstormEdge[] = [];

      const root = await createNode('root', 'brainstorm');
      root.data.isAnchor = true;
      nodes.push(root);

      // Cooking cluster
      const cooking = await createNode('cooking', 'cooking', 'root');
      cooking.data.isAnchor = true;
      nodes.push(cooking);
      edges.push(createEdge('root', 'cooking'));

      const recipe = await createNode('recipe', 'recipe', 'cooking');
      nodes.push(recipe);
      edges.push(createEdge('cooking', 'recipe'));

      // Chemistry cluster
      const chemistry = await createNode('chemistry', 'chemistry', 'root');
      chemistry.data.isAnchor = true;
      nodes.push(chemistry);
      edges.push(createEdge('root', 'chemistry'));

      const molecule = await createNode('molecule', 'molecule', 'chemistry');
      nodes.push(molecule);
      edges.push(createEdge('chemistry', 'molecule'));

      // Add "ingredients" - should go to cooking
      const ingredientsVector = await getEmbedding('ingredients');
      const ingredientsParent = findParentForNewNode(ingredientsVector, nodes, edges);

      console.log('\n=== CROSS-DOMAIN: ingredients ===');
      console.log('ingredients parent:', ingredientsParent?.data.label);

      // Add "chemical reaction" - should go to chemistry (more specific than "formula")
      const reactionVector = await getEmbedding('chemical reaction');
      const reactionParent = findParentForNewNode(reactionVector, nodes, edges);

      console.log('chemical reaction parent:', reactionParent?.data.label);

      // Ingredients should be cooking-related
      expect(
        ingredientsParent?.data.label === 'cooking' ||
        ingredientsParent?.data.label === 'recipe'
      ).toBe(true);

      // Chemical reaction should be chemistry-related
      expect(
        reactionParent?.data.label === 'chemistry' ||
        reactionParent?.data.label === 'molecule'
      ).toBe(true);
    });
  });
});
