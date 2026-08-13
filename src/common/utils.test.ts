import { getInteractiveMessageBody } from './utils';

describe('getInteractiveMessageBody — unrecognized type fallback (T18)', () => {
  test('returns an empty string instead of throwing for an unknown interactive type', () => {
    expect(getInteractiveMessageBody({ type: 'some_future_swiftchat_type' })).toBe('');
  });
});
