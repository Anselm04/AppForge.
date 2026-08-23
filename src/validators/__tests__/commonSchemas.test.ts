import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  usernameSchema,
  uuidSchema,
  urlSchema,
  nameSchema,
  paginationSchema,
  searchSchema,
} from '../commonSchemas';

describe('Common Schemas', () => {
  describe('emailSchema', () => {
    it('validates valid email addresses', () => {
      const validEmails = ['test@example.com', 'user.name@domain.org', 'user+tag@example.co.uk'];
      validEmails.forEach((email) => {
        expect(emailSchema.safeParse(email).success).toBe(true);
      });
    });

    it('rejects invalid email addresses', () => {
      const invalidEmails = ['invalid', 'invalid@', '@example.com', 'test@', ''];
      invalidEmails.forEach((email) => {
        expect(emailSchema.safeParse(email).success).toBe(false);
      });
    });
  });

  describe('passwordSchema', () => {
    it('validates strong passwords', () => {
      const validPasswords = ['Password1', 'SecurePass123'];
      validPasswords.forEach((password) => {
        expect(passwordSchema.safeParse(password).success).toBe(true);
      });
    });

    it('rejects passwords without uppercase', () => {
      expect(passwordSchema.safeParse('password1').success).toBe(false);
    });

    it('rejects passwords without lowercase', () => {
      expect(passwordSchema.safeParse('PASSWORD1').success).toBe(false);
    });

    it('rejects passwords without number', () => {
      expect(passwordSchema.safeParse('Password').success).toBe(false);
    });

    it('rejects passwords under 8 characters', () => {
      expect(passwordSchema.safeParse('Pass1').success).toBe(false);
    });
  });

  describe('usernameSchema', () => {
    it('validates valid usernames', () => {
      const validUsernames = ['user', 'User123', 'user_name', 'test_user_123'];
      validUsernames.forEach((username) => {
        expect(usernameSchema.safeParse(username).success).toBe(true);
      });
    });

    it('rejects usernames under 3 characters', () => {
      expect(usernameSchema.safeParse('ab').success).toBe(false);
    });

    it('rejects usernames with special characters', () => {
      expect(usernameSchema.safeParse('user@name').success).toBe(false);
      expect(usernameSchema.safeParse('user-name').success).toBe(false);
    });
  });

  describe('uuidSchema', () => {
    it('validates valid UUIDs', () => {
      const validUUIDs = ['550e8400-e29b-41d4-a716-446655440000', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'];
      validUUIDs.forEach((uuid) => {
        expect(uuidSchema.safeParse(uuid).success).toBe(true);
      });
    });

    it('rejects invalid UUIDs', () => {
      expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
      expect(uuidSchema.safeParse('12345').success).toBe(false);
    });
  });

  describe('urlSchema', () => {
    it('validates valid URLs', () => {
      const validURLs = ['https://example.com', 'http://localhost:3000'];
      validURLs.forEach((url) => {
        expect(urlSchema.safeParse(url).success).toBe(true);
      });
    });

    it('rejects invalid URLs', () => {
      const invalidURLs = ['not-a-url', 'ftp://example.com', 'example.com', ''];
      invalidURLs.forEach((url) => {
        expect(urlSchema.safeParse(url).success).toBe(false);
      });
    });
  });

  describe('nameSchema', () => {
    it('validates valid names', () => {
      const validNames = ['John', 'John Doe', 'Mary-Jane', "O'Connor"];
      validNames.forEach((name) => {
        expect(nameSchema.safeParse(name).success).toBe(true);
      });
    });

    it('rejects empty names', () => {
      expect(nameSchema.safeParse('').success).toBe(false);
    });

    it('rejects names with numbers', () => {
      expect(nameSchema.safeParse('John123').success).toBe(false);
    });
  });

  describe('paginationSchema', () => {
    it('validates valid pagination', () => {
      const result = paginationSchema.safeParse({ page: '1', limit: '10' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(10);
      }
    });

    it('applies defaults', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(10);
      }
    });

    it('rejects negative page', () => {
      expect(paginationSchema.safeParse({ page: '-1' }).success).toBe(false);
    });

    it('rejects limit over 100', () => {
      expect(paginationSchema.safeParse({ limit: '101' }).success).toBe(false);
    });
  });

  describe('searchSchema', () => {
    it('validates valid search params', () => {
      const result = searchSchema.safeParse({ q: 'test', sort: 'desc', sortBy: 'createdAt' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.q).toBe('test');
        expect(result.data.sort).toBe('desc');
        expect(result.data.sortBy).toBe('createdAt');
      }
    });

    it('applies default sort', () => {
      const result = searchSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sort).toBe('asc');
      }
    });

    it('rejects invalid sort direction', () => {
      expect(searchSchema.safeParse({ sort: 'invalid' }).success).toBe(false);
    });
  });
});
