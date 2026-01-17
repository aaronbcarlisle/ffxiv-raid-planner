import { describe, it, expect } from 'vitest';
import { isAuthRelated403 } from './api';

describe('isAuthRelated403', () => {
  describe('detects auth-related 403 messages', () => {
    it('matches "Please log in" message from backend', () => {
      expect(isAuthRelated403('This static group is private. Please log in.')).toBe(true);
    });

    it('matches "login" variations', () => {
      expect(isAuthRelated403('You must login first')).toBe(true);
      expect(isAuthRelated403('Please Login to continue')).toBe(true);
    });

    it('matches "authenticated" variations', () => {
      expect(isAuthRelated403('Not authenticated')).toBe(true);
      expect(isAuthRelated403('User is not authenticated')).toBe(true);
      expect(isAuthRelated403('Authentication required')).toBe(true);
    });

    it('matches "session" variations', () => {
      expect(isAuthRelated403('Session expired')).toBe(true);
      expect(isAuthRelated403('Your session invalid')).toBe(true);
    });

    it('is case insensitive', () => {
      expect(isAuthRelated403('PLEASE LOG IN')).toBe(true);
      expect(isAuthRelated403('NOT AUTHENTICATED')).toBe(true);
      expect(isAuthRelated403('Session EXPIRED')).toBe(true);
    });
  });

  describe('does not match true permission errors', () => {
    it('rejects generic permission denied', () => {
      expect(isAuthRelated403('Permission denied')).toBe(false);
    });

    it('rejects insufficient permissions', () => {
      expect(isAuthRelated403('You do not have permission to edit this')).toBe(false);
    });

    it('rejects role-based denials', () => {
      expect(isAuthRelated403('Only owners can delete this group')).toBe(false);
      expect(isAuthRelated403('Leads and above can edit the roster')).toBe(false);
    });

    it('rejects private group without auth hint', () => {
      // This is a true permission error - user is logged in but not a member
      expect(isAuthRelated403('This static group is private')).toBe(false);
    });

    it('rejects generic forbidden', () => {
      expect(isAuthRelated403('Forbidden')).toBe(false);
      expect(isAuthRelated403('Access denied')).toBe(false);
    });

    it('rejects empty and generic messages', () => {
      expect(isAuthRelated403('')).toBe(false);
      expect(isAuthRelated403('HTTP 403')).toBe(false);
      expect(isAuthRelated403('Error occurred')).toBe(false);
    });
  });
});
