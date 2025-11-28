
import { GameState, NewsEvent } from '../../shared/types';

export class EventService {
  static process(gameState: GameState): void {
    // Synchronous maintenance of events if needed.
    // Note: Event generation via AI is handled asynchronously in the App layer (App.tsx)
    // to prevent blocking the game loop and to avoid Immer draft revocation issues with async/await.
    
    // Cleanup expired notifications logic could go here if not handled in UI slice.
  }

  static getModifier(gameState: GameState, target: string): number {
    let modifier = 1.0;
    const activeWindow = 5; // Events last 5 days
    
    const activeEvents = gameState.events.filter(event => 
        event.type === 'NEWS' && 
        (gameState.day - event.turnCreated) < activeWindow
    ) as NewsEvent[];

    activeEvents.forEach(event => {
        if (event.effect && event.effect.target === target) {
            modifier += event.effect.modifier;
        }
    });
    
    return modifier;
  }
}
