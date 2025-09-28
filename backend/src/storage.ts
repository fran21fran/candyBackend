import { 
  users, 
  gameScores, 
  suggestions, 
  suggestionLikes,
  type User, 
  type InsertUser, 
  type GameScore, 
  type InsertGameScore,
  type Suggestion,
  type InsertSuggestion,
  type SuggestionLike,
  type InsertSuggestionLike
} from "./schema.js";
import { db } from "./db.js";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPremium(id: string, isPremium: boolean): Promise<User>;
  
  // Game scores methods
  saveGameScore(userId: string, scoreData: InsertGameScore): Promise<GameScore>;
  getUserScores(userId: string): Promise<GameScore[]>;
  getGameLeaderboard(gameId: string, limit?: number): Promise<(GameScore & { username: string })[]>;
  getGlobalLeaderboard(limit?: number): Promise<{ userId: string; username: string; totalScore: number; gamesPlayed: number }[]>;
  getUserRanking(userId: string): Promise<{ rank: number; totalScore: number; gamesPlayed: number } | null>;

  // Suggestions methods
  createSuggestion(userId: string, suggestionData: InsertSuggestion): Promise<Suggestion>;
  getSuggestionsByLanguage(language: string, userId?: string): Promise<(Suggestion & { userHasLiked: boolean })[]>;
  getAllSuggestions(userId?: string): Promise<(Suggestion & { userHasLiked: boolean })[]>;
  likeSuggestion(userId: string, suggestionId: string): Promise<void>;
  unlikeSuggestion(userId: string, suggestionId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserPremium(id: string, isPremium: boolean): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        isPremium, 
        subscriptionDate: isPremium ? new Date() : null 
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Game scores methods
  async saveGameScore(userId: string, scoreData: InsertGameScore): Promise<GameScore> {
    const [score] = await db
      .insert(gameScores)
      .values({ ...scoreData, userId })
      .returning();
    return score;
  }

  async getUserScores(userId: string): Promise<GameScore[]> {
    return await db
      .select()
      .from(gameScores)
      .where(eq(gameScores.userId, userId))
      .orderBy(desc(gameScores.playedAt));
  }

  async getGameLeaderboard(gameId: string, limit: number = 10): Promise<(GameScore & { username: string })[]> {
    return await db
      .select({
        id: gameScores.id,
        userId: gameScores.userId,
        gameId: gameScores.gameId,
        score: gameScores.score,
        completionTime: gameScores.completionTime,
        difficulty: gameScores.difficulty,
        language: gameScores.language,
        playedAt: gameScores.playedAt,
        createdAt: gameScores.createdAt,
        username: users.username,
      })
      .from(gameScores)
      .innerJoin(users, eq(gameScores.userId, users.id))
      .where(eq(gameScores.gameId, gameId))
      .orderBy(desc(gameScores.score), gameScores.completionTime)
      .limit(limit);
  }

  async getGlobalLeaderboard(limit: number = 10): Promise<{ userId: string; username: string; totalScore: number; gamesPlayed: number }[]> {
    return await db
      .select({
        userId: gameScores.userId,
        username: users.username,
        totalScore: sql<number>`sum(${gameScores.score})`,
        gamesPlayed: sql<number>`count(${gameScores.id})`,
      })
      .from(gameScores)
      .innerJoin(users, eq(gameScores.userId, users.id))
      .groupBy(gameScores.userId, users.username)
      .orderBy(desc(sql`sum(${gameScores.score})`))
      .limit(limit);
  }

  async getUserRanking(userId: string): Promise<{ rank: number; totalScore: number; gamesPlayed: number } | null> {
    const userStats = await db
      .select({
        totalScore: sql<number>`sum(${gameScores.score})`,
        gamesPlayed: sql<number>`count(${gameScores.id})`,
      })
      .from(gameScores)
      .where(eq(gameScores.userId, userId))
      .groupBy(gameScores.userId);

    if (userStats.length === 0) {
      return null;
    }

    const { totalScore, gamesPlayed } = userStats[0];

    const higherRankedUsers = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(gameScores)
      .innerJoin(users, eq(gameScores.userId, users.id))
      .groupBy(gameScores.userId)
      .having(sql`sum(${gameScores.score}) > ${totalScore}`);

    const rank = (higherRankedUsers[0]?.count || 0) + 1;

    return { rank, totalScore, gamesPlayed };
  }

  // Suggestions methods
  async createSuggestion(userId: string, suggestionData: InsertSuggestion): Promise<Suggestion> {
    const user = await this.getUser(userId);
    const [suggestion] = await db
      .insert(suggestions)
      .values({ 
        ...suggestionData, 
        submittedBy: user?.username || "Usuario" 
      })
      .returning();
    return suggestion;
  }

  async getSuggestionsByLanguage(language: string, userId?: string): Promise<(Suggestion & { userHasLiked: boolean })[]> {
    const suggestionsQuery = await db
      .select()
      .from(suggestions)
      .where(eq(suggestions.language, language))
      .orderBy(desc(suggestions.likes), desc(suggestions.submittedAt));

    if (!userId) {
      return suggestionsQuery.map(suggestion => ({ ...suggestion, userHasLiked: false }));
    }

    // Check which suggestions the user has liked
    const likedSuggestions = await db
      .select({ suggestionId: suggestionLikes.suggestionId })
      .from(suggestionLikes)
      .where(eq(suggestionLikes.userId, userId));

    const likedSet = new Set(likedSuggestions.map(like => like.suggestionId));

    return suggestionsQuery.map(suggestion => ({
      ...suggestion,
      userHasLiked: likedSet.has(suggestion.id)
    }));
  }

  async getAllSuggestions(userId?: string): Promise<(Suggestion & { userHasLiked: boolean })[]> {
    const suggestionsQuery = await db
      .select()
      .from(suggestions)
      .orderBy(desc(suggestions.likes), desc(suggestions.submittedAt));

    if (!userId) {
      return suggestionsQuery.map(suggestion => ({ ...suggestion, userHasLiked: false }));
    }

    // Check which suggestions the user has liked
    const likedSuggestions = await db
      .select({ suggestionId: suggestionLikes.suggestionId })
      .from(suggestionLikes)
      .where(eq(suggestionLikes.userId, userId));

    const likedSet = new Set(likedSuggestions.map(like => like.suggestionId));

    return suggestionsQuery.map(suggestion => ({
      ...suggestion,
      userHasLiked: likedSet.has(suggestion.id)
    }));
  }

  async likeSuggestion(userId: string, suggestionId: string): Promise<void> {
    // Check if already liked
    const existingLike = await db
      .select()
      .from(suggestionLikes)
      .where(and(
        eq(suggestionLikes.userId, userId),
        eq(suggestionLikes.suggestionId, suggestionId)
      ));

    if (existingLike.length > 0) {
      // Already liked, remove like (toggle)
      await this.unlikeSuggestion(userId, suggestionId);
      return;
    }

    // Add like
    await db
      .insert(suggestionLikes)
      .values({ userId, suggestionId });

    // Increment like count
    await db
      .update(suggestions)
      .set({ likes: sql`${suggestions.likes} + 1` })
      .where(eq(suggestions.id, suggestionId));
  }

  async unlikeSuggestion(userId: string, suggestionId: string): Promise<void> {
    await db
      .delete(suggestionLikes)
      .where(and(
        eq(suggestionLikes.userId, userId),
        eq(suggestionLikes.suggestionId, suggestionId)
      ));

    // Decrement like count
    await db
      .update(suggestions)
      .set({ likes: sql`${suggestions.likes} - 1` })
      .where(eq(suggestions.id, suggestionId));
  }
}

export const storage = new DatabaseStorage();