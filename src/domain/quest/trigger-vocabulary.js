// src/domain/quest/trigger-vocabulary.js
//
// trigger-vocabulary.js
//
// The vocabulary of the trigger model: the condition fields and the effect
// types the game understands. It is the contract between the config schema
// (which refuses anything outside it) and the trigger engine (which
// evaluates it) — one list, so the two can never drift apart.
//
// The lists are used by:
//   quest/triggers.js        — evaluates the normalized model
//   content/street-schema.js — validates the raw JSON of a street
//
// The vocabulary lives with the model it describes; the content layer (the
// adapter that reads the JSON) depends on it, never the other way round.

/** The condition fields the model knows about. */
export const CONDITION_KEYS = ['mission', 'flags', 'items', 'money', 'defeated', 'position'];

/** The effect types the model knows about. */
export const EFFECT_TYPES = ['mission', 'item', 'money', 'flag'];
