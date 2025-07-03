/**
 * Common Test Data Generators
 * Provides consistent test data across all test files
 */

class TestDataGenerator {
    static createMockTranscription() {
        return {
            transcript: "This is a test transcription with some content for testing purposes.",
            filename: "test-audio.mp3",
            fileType: "audio/mp3",
            fileSize: 1024000,
            duration: 30,
            wordCount: 12,
            characterCount: 67,
            processingTime: "2.5s"
        };
    }

    static createMockAction(overrides = {}) {
        const defaultAction = {
            id: `action-${Date.now()}`,
            name: 'Test Action',
            description: 'A test action for testing purposes',
            type: 'template',
            template: 'Summary: {{.Transcript}}',
            variables: ['Transcript', 'Filename', 'Date'],
            created: new Date().toISOString()
        };

        return { ...defaultAction, ...overrides };
    }

    static createOpenAIAction(overrides = {}) {
        const defaultAction = {
            id: `openai-action-${Date.now()}`,
            name: 'AI Analysis',
            description: 'AI-powered content analysis',
            type: 'openai',
            prompt: 'Analyze this transcript and provide key insights',
            model: 'gpt-3.5-turbo',
            temperature: 0.7,
            maxTokens: 1000,
            created: new Date().toISOString()
        };

        return { ...defaultAction, ...overrides };
    }

    static createMockHistoryEntry(overrides = {}) {
        const defaultEntry = {
            id: `history-${Date.now()}`,
            timestamp: new Date().toISOString(),
            filename: 'test-recording.wav',
            fileType: 'audio/wav',
            fileSize: 2048000,
            duration: 45,
            transcript: 'This is a mock history entry transcript for testing.',
            wordCount: 10,
            characterCount: 52
        };

        return { ...defaultEntry, ...overrides };
    }

    static createMockActionResult(overrides = {}) {
        const defaultResult = {
            success: true,
            actionName: 'Test Action',
            actionType: 'template',
            output: 'This is the processed output from the test action.',
            processedAt: new Date().toISOString(),
            processingTime: '1.2s'
        };

        return { ...defaultResult, ...overrides };
    }

    static createMockFileList() {
        return [
            {
                name: 'meeting-recording.mp3',
                type: 'audio/mp3',
                size: 5242880,
                lastModified: Date.now() - 86400000 // 1 day ago
            },
            {
                name: 'interview.wav',
                type: 'audio/wav',
                size: 10485760,
                lastModified: Date.now() - 172800000 // 2 days ago
            },
            {
                name: 'presentation.mp4',
                type: 'video/mp4',
                size: 52428800,
                lastModified: Date.now() - 259200000 // 3 days ago
            }
        ];
    }

    static createMaliciousActionData() {
        return {
            id: 'malicious-action',
            name: '<script>alert("name")</script>Malicious Action',
            description: '<img src="x" onerror="alert(1)">Evil description',
            template: '"><script>alert("template")</script>Evil template',
            type: 'template'
        };
    }

    static createLargeDataset(count = 100) {
        const items = [];
        for (let i = 0; i < count; i++) {
            items.push({
                id: `item-${i}`,
                name: `Item ${i}`,
                description: `Description for item ${i}`,
                type: i % 2 === 0 ? 'template' : 'openai',
                created: new Date(Date.now() - (i * 86400000)).toISOString(),
                data: `Data content for item ${i}`.repeat(10)
            });
        }
        return items;
    }

    static createPerformanceTestData() {
        return {
            smallString: 'Test'.repeat(10),
            mediumString: 'Test'.repeat(100),
            largeString: 'Test'.repeat(1000),
            xlString: 'Test'.repeat(10000),
            maliciousSmall: '<script>alert("test")</script>',
            maliciousMedium: '<script>alert("test")</script>'.repeat(10),
            maliciousLarge: '<script>alert("test")</script>'.repeat(100)
        };
    }

    static createFormData() {
        return {
            valid: {
                name: 'Valid Action Name',
                description: 'A valid description for testing',
                template: 'Template: {{.Transcript}}',
                type: 'template'
            },
            empty: {
                name: '',
                description: '',
                template: '',
                type: 'template'
            },
            undefined: {
                name: undefined,
                description: undefined,
                template: undefined,
                type: 'template'
            },
            null: {
                name: null,
                description: null,
                template: null,
                type: 'template'
            },
            malicious: {
                name: '<script>alert("xss")</script>',
                description: '<img src="x" onerror="alert(1)">',
                template: '"><script>evil()</script>',
                type: 'template'
            }
        };
    }

    static createMockSettings() {
        return {
            incognitoMode: false,
            historyEnabled: true,
            autoSave: true,
            maxHistoryItems: 100,
            defaultAction: '',
            theme: 'light'
        };
    }

    static createMockAPIResponses() {
        return {
            transcriptionSuccess: {
                text: "This is a successful transcription result.",
                duration: 30.5,
                language: "en"
            },
            transcriptionError: {
                error: {
                    message: "Transcription failed",
                    type: "invalid_request_error",
                    code: "audio_too_long"
                }
            },
            openaiSuccess: {
                choices: [{
                    message: {
                        content: "This is a successful AI processing result."
                    },
                    finish_reason: "stop"
                }],
                usage: {
                    prompt_tokens: 50,
                    completion_tokens: 25,
                    total_tokens: 75
                }
            },
            openaiError: {
                error: {
                    message: "Rate limit exceeded",
                    type: "rate_limit_error",
                    code: "rate_limit_exceeded"
                }
            }
        };
    }

    static createMockToastNotifications() {
        return [
            {
                type: 'success',
                message: 'Action completed successfully',
                duration: 3000
            },
            {
                type: 'error',
                message: 'An error occurred while processing',
                duration: 5000
            },
            {
                type: 'warning',
                message: 'Please check your input',
                duration: 4000
            },
            {
                type: 'info',
                message: 'Processing your request...',
                duration: 2000
            }
        ];
    }
}

module.exports = TestDataGenerator;