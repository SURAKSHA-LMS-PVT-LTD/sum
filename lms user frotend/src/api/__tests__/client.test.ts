import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../client';

describe('ApiClient', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        vi.clearAllMocks();

        // Mock localStorage
        const localStorageMock = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
        };
        global.localStorage = localStorageMock as any;
    });

    describe('Error Handling', () => {
        it('should return user-friendly error message for 404', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                text: async () => JSON.stringify({
                    message: 'Resource not found',
                    statusCode: 404,
                    error: 'NotFoundError',
                }),
                json: async () => ({
                    message: 'Resource not found',
                    statusCode: 404,
                    error: 'NotFoundError',
                }),
            });

            try {
                await apiClient.get('/test-endpoint');
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                expect(error.message).toBe('Resource not found');
            }
        });

        it('should retry on 503 errors', async () => {
            let callCount = 0;
            global.fetch = vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount < 3) {
                    return Promise.resolve({
                        ok: false,
                        status: 503,
                        statusText: 'Service Unavailable',
                        text: async () => JSON.stringify({
                            message: 'Service unavailable',
                            statusCode: 503,
                            error: 'ServiceUnavailable',
                        }),
                        json: async () => ({
                            message: 'Service unavailable',
                            statusCode: 503,
                            error: 'ServiceUnavailable',
                        }),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    headers: new Headers({ 'Content-Type': 'application/json' }),
                    json: async () => ({ success: true, data: 'test' }),
                });
            });

            const result = await apiClient.get('/test-endpoint');
            expect(callCount).toBe(3);
            expect(result).toEqual({ success: true, data: 'test' });
        });

        it('should not retry on 400 errors', async () => {
            let callCount = 0;
            global.fetch = vi.fn().mockImplementation(() => {
                callCount++;
                return Promise.resolve({
                    ok: false,
                    status: 400,
                    statusText: 'Bad Request',
                    text: async () => JSON.stringify({
                        message: 'Invalid request',
                        statusCode: 400,
                        error: 'BadRequest',
                    }),
                    json: async () => ({
                        message: 'Invalid request',
                        statusCode: 400,
                        error: 'BadRequest',
                    }),
                });
            });

            try {
                await apiClient.get('/test-endpoint');
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                expect(callCount).toBe(1); // Should not retry
                expect(error.message).toBe('Invalid request');
            }
        });
    });

    describe('GET Requests', () => {
        it('should make GET request with query parameters', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({ success: true, data: [] }),
            });

            await apiClient.get('/test', { page: 1, limit: 10 });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('page=1'),
                expect.any(Object)
            );
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('limit=10'),
                expect.any(Object)
            );
        });
    });

    describe('POST Requests', () => {
        it('should handle FormData correctly', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({ success: true }),
            });

            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.txt');

            await apiClient.post('/upload', formData);

            const fetchCall = (global.fetch as any).mock.calls[0];
            expect(fetchCall[1].body).toBeInstanceOf(FormData);
            // Content-Type should not be set for FormData (browser sets it with boundary)
            expect(fetchCall[1].headers['Content-Type']).toBeUndefined();
        });

        it('should handle JSON data correctly', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({ success: true }),
            });

            await apiClient.post('/test', { name: 'test' });

            const fetchCall = (global.fetch as any).mock.calls[0];
            expect(fetchCall[1].body).toBe(JSON.stringify({ name: 'test' }));
            expect(fetchCall[1].headers['Content-Type']).toBe('application/json');
        });
    });
});
