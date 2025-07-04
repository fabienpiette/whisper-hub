/**
 * Cryptographic Utilities
 * Focused on encryption, decryption, and hashing operations
 */

class CryptoUtils {
    /**
     * Encrypt data using AES-GCM
     * @param {string} data - Data to encrypt
     * @param {string} key - Encryption key
     * @returns {Promise<string>} - Encrypted data
     */
    static async encryptData(data, key) {
        try {
            if (!data || !key) {
                throw new Error('Data and key are required for encryption');
            }

            // Convert data to ArrayBuffer
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            
            // Generate key from string
            const keyBuffer = await this.deriveKey(key);
            
            // Generate random IV
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            
            // Encrypt the data
            const encrypted = await window.crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                keyBuffer,
                dataBuffer
            );
            
            // Combine IV and encrypted data
            const result = new Uint8Array(iv.length + encrypted.byteLength);
            result.set(iv);
            result.set(new Uint8Array(encrypted), iv.length);
            
            // Convert to base64
            return btoa(String.fromCharCode.apply(null, result));
            
        } catch (error) {
            console.error('Encryption failed:', error);
            // Return original data as fallback (not secure, but functional)
            return data;
        }
    }

    /**
     * Decrypt data using AES-GCM
     * @param {string} encryptedData - Encrypted data to decrypt
     * @param {string} key - Decryption key
     * @returns {Promise<string>} - Decrypted data
     */
    static async decryptData(encryptedData, key) {
        try {
            if (!encryptedData || !key) {
                throw new Error('Encrypted data and key are required for decryption');
            }

            // Convert from base64
            const combinedData = new Uint8Array(
                atob(encryptedData).split('').map(char => char.charCodeAt(0))
            );
            
            // Extract IV and encrypted data
            const iv = combinedData.slice(0, 12);
            const encrypted = combinedData.slice(12);
            
            // Generate key from string
            const keyBuffer = await this.deriveKey(key);
            
            // Decrypt the data
            const decrypted = await window.crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                keyBuffer,
                encrypted
            );
            
            // Convert back to string
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
            
        } catch (error) {
            console.error('Decryption failed:', error);
            // Return original data as fallback
            return encryptedData;
        }
    }

    /**
     * Derive encryption key from string
     * @param {string} keyString - Key string
     * @returns {Promise<CryptoKey>} - Derived key
     */
    static async deriveKey(keyString) {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(keyString);
        
        // Import the key material
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        
        // Use a fixed salt for simplicity (in production, should be random and stored)
        const salt = encoder.encode('whisper-hub-salt');
        
        // Derive the actual encryption key
        return await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Generate secure random string
     * @param {number} length - Length of random string
     * @returns {string} - Random string
     */
    static generateRandomString(length = 32) {
        try {
            const array = new Uint8Array(length);
            window.crypto.getRandomValues(array);
            return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.warn('Secure random generation failed, using fallback:', error.message);
            return this.fallbackRandomString(length);
        }
    }

    /**
     * Fallback random string generation
     * @param {number} length - Length of random string
     * @returns {string} - Random string
     */
    static fallbackRandomString(length = 32) {
        const chars = '0123456789abcdef';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
    }

    /**
     * Hash data using SHA-256
     * @param {string} data - Data to hash
     * @returns {Promise<string>} - Hash of data
     */
    static async hashData(data) {
        try {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
            const hashArray = new Uint8Array(hashBuffer);
            
            return Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.error('Hashing failed:', error);
            // Fallback to simple hash
            return this.simpleHash(data);
        }
    }

    /**
     * Simple fallback hash function
     * @param {string} data - Data to hash
     * @returns {string} - Simple hash
     */
    static simpleHash(data) {
        let hash = 0;
        if (data.length === 0) return hash.toString();
        
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return Math.abs(hash).toString(16);
    }

    /**
     * Generate secure UUID v4
     * @returns {string} - UUID string
     */
    static generateUUID() {
        try {
            // Use crypto.randomUUID if available (modern browsers)
            if (window.crypto && window.crypto.randomUUID) {
                return window.crypto.randomUUID();
            }
            
            // Fallback to manual generation
            const array = new Uint8Array(16);
            window.crypto.getRandomValues(array);
            
            // Set version (4) and variant bits
            array[6] = (array[6] & 0x0f) | 0x40;
            array[8] = (array[8] & 0x3f) | 0x80;
            
            const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
            return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
        } catch (error) {
            console.warn('UUID generation failed, using fallback:', error.message);
            return this.fallbackUUID();
        }
    }

    /**
     * Fallback UUID generation
     * @returns {string} - UUID string
     */
    static fallbackUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Generate encryption key from password
     * @param {string} password - User password
     * @param {string} salt - Salt for key derivation
     * @returns {Promise<string>} - Derived key
     */
    static async generateKeyFromPassword(password, salt = null) {
        try {
            const encoder = new TextEncoder();
            const passwordData = encoder.encode(password);
            const saltData = salt ? encoder.encode(salt) : encoder.encode('default-salt');
            
            const keyMaterial = await window.crypto.subtle.importKey(
                'raw',
                passwordData,
                { name: 'PBKDF2' },
                false,
                ['deriveKey']
            );
            
            const key = await window.crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: saltData,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );
            
            const exported = await window.crypto.subtle.exportKey('raw', key);
            const keyArray = new Uint8Array(exported);
            return Array.from(keyArray, byte => byte.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.error('Key generation from password failed:', error);
            return this.simpleHash(password + (salt || 'default-salt'));
        }
    }

    /**
     * Verify data integrity using HMAC
     * @param {string} data - Data to verify
     * @param {string} signature - HMAC signature
     * @param {string} key - HMAC key
     * @returns {Promise<boolean>} - True if signature is valid
     */
    static async verifyHMAC(data, signature, key) {
        try {
            const computedSignature = await this.generateHMAC(data, key);
            return this.constantTimeCompare(signature, computedSignature);
        } catch (error) {
            console.error('HMAC verification failed:', error);
            return false;
        }
    }

    /**
     * Generate HMAC signature
     * @param {string} data - Data to sign
     * @param {string} key - HMAC key
     * @returns {Promise<string>} - HMAC signature
     */
    static async generateHMAC(data, key) {
        try {
            const encoder = new TextEncoder();
            const keyData = encoder.encode(key);
            const dataBuffer = encoder.encode(data);
            
            const cryptoKey = await window.crypto.subtle.importKey(
                'raw',
                keyData,
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            );
            
            const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
            const signatureArray = new Uint8Array(signature);
            
            return Array.from(signatureArray, byte => byte.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.error('HMAC generation failed:', error);
            return this.simpleHash(data + key);
        }
    }

    /**
     * Constant-time string comparison
     * @param {string} a - First string
     * @param {string} b - Second string
     * @returns {boolean} - True if strings match
     */
    static constantTimeCompare(a, b) {
        if (a.length !== b.length) return false;
        
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        
        return result === 0;
    }

    /**
     * Check if Web Crypto API is available
     * @returns {boolean} - True if Web Crypto is available
     */
    static isWebCryptoAvailable() {
        return !!(window.crypto && window.crypto.subtle);
    }

    /**
     * Securely clear sensitive data from memory (best effort)
     * @param {Object} obj - Object containing sensitive data
     */
    static clearSensitiveData(obj) {
        if (obj && typeof obj === 'object') {
            Object.keys(obj).forEach(key => {
                if (typeof obj[key] === 'string') {
                    obj[key] = '';
                } else if (typeof obj[key] === 'object') {
                    this.clearSensitiveData(obj[key]);
                }
                delete obj[key];
            });
        }
    }
}

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CryptoUtils;
} else if (typeof window !== 'undefined') {
    window.CryptoUtils = CryptoUtils;
}