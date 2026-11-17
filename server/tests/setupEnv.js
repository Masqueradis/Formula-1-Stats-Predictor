'use strict';

process.env.DATABASE_URL ||= 'postgres://f1:f1@127.0.0.1:5432/f1stats_test';
process.env.JWT_SECRET ||= 'test-jwt-secret';
