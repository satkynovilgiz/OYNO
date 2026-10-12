import { draftAfterSave, newPortfolio, rename } from './portfolioModel';

describe('REGRESSION: portfolio save keeps edits made while the write was pending', () => {
  it('the sent draft is cleared; a newer draft stays', () => {
    const sent = rename(newPortfolio('Mine'), 'Sent title');
    expect(draftAfterSave(sent, sent)).toBeNull();
    const newer = rename(sent, 'Typed during the save');
    expect(draftAfterSave(newer, sent)).toBe(newer);
    expect(draftAfterSave(undefined, sent)).toBeNull();
  });
});
