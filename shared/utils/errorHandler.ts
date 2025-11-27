export type ErrorType = 'VALIDATION' | 'BUSINESS' | 'SYSTEM';

export class GameError extends Error {
  type: ErrorType;
  code: string;
  
  constructor(message: string, type: ErrorType, code: string) {
    super(message);
    this.type = type;
    this.code = code;
    // Set the prototype explicitly for extending built-ins
    Object.setPrototypeOf(this, GameError.prototype);
  }
}

export function handleGameError(error: unknown) {
  if (error instanceof GameError) {
    console.warn(`[${error.type}] ${error.code}: ${error.message}`);
    // In a real application, you would dispatch this to a notification system store
    // useGameStore.getState().addNotification({ type: 'error', message: error.message });
  } else if (error instanceof Error) {
    console.error('[System Error]', error.message);
  } else {
    console.error('[Unknown Error]', error);
  }
}