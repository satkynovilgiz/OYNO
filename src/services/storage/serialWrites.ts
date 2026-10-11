/**
 * One queue per persisted storage key. Each task runs only after the
 * previous one has FINISHED (resolved or rejected), so two mutations can
 * never compute their next state from the same old snapshot and then
 * overwrite each other - even for different owners, whose records share
 * one persisted object.
 *
 * A failed task does not stop the queue: its own promise rejects (or
 * resolves to its failure value), and the next task starts normally. No
 * task is ever retried by the queue itself - retrying stays a user action.
 */
export type SerialQueue = <T>(task: () => Promise<T>) => Promise<T>;

export function createSerialQueue(): SerialQueue {
  let tail: Promise<unknown> = Promise.resolve();
  return <T,>(task: () => Promise<T>) => {
    const run = tail.then(task, task);
    // The next task waits for this one either way - failures are not propagated down the chain.
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
