const https = require('https');
const { version } = require('../../package.json');
const logger = require('./logger');

class UpdateChecker {
    constructor() {
        this.currentVersion = version;
        this.repoOwner = 'iCaptainNemo'; // Replace with actual repo owner
        this.repoName = 'helpdesk'; // Replace with actual repo name
        this.apiUrl = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`;
    }

    /**
     * Check for updates from GitHub releases
     * @param {boolean} includePrerelease - Include pre-release versions
     * @returns {Promise<Object>} Update information
     */
    async checkForUpdates(includePrerelease = false) {
        try {
            logger.info('Checking for application updates...');
            
            const releaseInfo = await this.getLatestRelease(includePrerelease);
            
            if (!releaseInfo) {
                logger.warn('No release information found');
                return {
                    updateAvailable: false,
                    currentVersion: this.currentVersion,
                    message: 'No release information available'
                };
            }

            const latestVersion = this.cleanVersion(releaseInfo.tag_name);
            const currentVersion = this.cleanVersion(this.currentVersion);
            
            const updateAvailable = this.isNewerVersion(latestVersion, currentVersion);
            
            const result = {
                updateAvailable,
                currentVersion: this.currentVersion,
                latestVersion: releaseInfo.tag_name,
                releaseDate: releaseInfo.published_at,
                releaseNotes: releaseInfo.body,
                downloadUrl: releaseInfo.html_url,
                assets: releaseInfo.assets.map(asset => ({
                    name: asset.name,
                    downloadUrl: asset.browser_download_url,
                    size: asset.size,
                    contentType: asset.content_type
                }))
            };

            if (updateAvailable) {
                logger.info(`Update available: ${this.currentVersion} -> ${releaseInfo.tag_name}`);
            } else {
                logger.info('Application is up to date');
            }

            return result;
            
        } catch (error) {
            logger.error('Error checking for updates:', error);
            return {
                updateAvailable: false,
                currentVersion: this.currentVersion,
                error: error.message
            };
        }
    }

    /**
     * Get latest release information from GitHub API
     * @param {boolean} includePrerelease - Include pre-release versions
     * @returns {Promise<Object>} Release information
     */
    getLatestRelease(includePrerelease = false) {
        return new Promise((resolve, reject) => {
            const url = includePrerelease 
                ? `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases`
                : this.apiUrl;

            const options = {
                headers: {
                    'User-Agent': `Helpdesk-Jarvis/${this.currentVersion}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            };

            https.get(url, options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        
                        if (res.statusCode !== 200) {
                            reject(new Error(`GitHub API error: ${parsed.message || 'Unknown error'}`));
                            return;
                        }

                        if (includePrerelease && Array.isArray(parsed)) {
                            // Find first release (including pre-releases)
                            const release = parsed.find(r => !r.draft);
                            resolve(release);
                        } else {
                            resolve(parsed);
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse GitHub API response: ${error.message}`));
                    }
                });

            }).on('error', (error) => {
                reject(new Error(`Failed to fetch release information: ${error.message}`));
            });
        });
    }

    /**
     * Clean version string (remove 'v' prefix, etc.)
     * @param {string} version - Version string
     * @returns {string} Cleaned version
     */
    cleanVersion(version) {
        return version.replace(/^v/, '').trim();
    }

    /**
     * Compare two semantic versions
     * @param {string} version1 - First version
     * @param {string} version2 - Second version  
     * @returns {boolean} True if version1 is newer than version2
     */
    isNewerVersion(version1, version2) {
        const v1Parts = version1.split('.').map(Number);
        const v2Parts = version2.split('.').map(Number);
        
        // Pad with zeros if needed
        const maxLength = Math.max(v1Parts.length, v2Parts.length);
        while (v1Parts.length < maxLength) v1Parts.push(0);
        while (v2Parts.length < maxLength) v2Parts.push(0);
        
        for (let i = 0; i < maxLength; i++) {
            if (v1Parts[i] > v2Parts[i]) return true;
            if (v1Parts[i] < v2Parts[i]) return false;
        }
        
        return false; // Versions are equal
    }

    /**
     * Get update information formatted for display
     * @returns {Promise<string>} Formatted update information
     */
    async getUpdateStatus() {
        const updateInfo = await this.checkForUpdates();
        
        if (updateInfo.error) {
            return `Update check failed: ${updateInfo.error}`;
        }
        
        if (updateInfo.updateAvailable) {
            return `Update available: ${updateInfo.currentVersion} -> ${updateInfo.latestVersion}`;
        }
        
        return `Current version ${updateInfo.currentVersion} is up to date`;
    }

    /**
     * Schedule periodic update checks
     * @param {number} intervalMs - Check interval in milliseconds
     * @returns {NodeJS.Timeout} Interval timer
     */
    scheduleUpdateChecks(intervalMs = 24 * 60 * 60 * 1000) { // 24 hours default
        logger.info(`Scheduling update checks every ${intervalMs / 1000 / 60 / 60} hours`);
        
        return setInterval(async () => {
            try {
                const updateInfo = await this.checkForUpdates();
                
                if (updateInfo.updateAvailable) {
                    logger.info('Scheduled update check found new version:', updateInfo.latestVersion);
                    // Here you could emit an event or call a callback to notify the UI
                }
            } catch (error) {
                logger.error('Scheduled update check failed:', error);
            }
        }, intervalMs);
    }

    /**
     * Get release notes for a specific version
     * @param {string} version - Version to get notes for
     * @returns {Promise<string>} Release notes
     */
    async getReleaseNotes(version) {
        try {
            const url = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/tags/${version}`;
            
            const options = {
                headers: {
                    'User-Agent': `Helpdesk-Jarvis/${this.currentVersion}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            };

            return new Promise((resolve, reject) => {
                https.get(url, options, (res) => {
                    let data = '';

                    res.on('data', (chunk) => {
                        data += chunk;
                    });

                    res.on('end', () => {
                        try {
                            const release = JSON.parse(data);
                            resolve(release.body || 'No release notes available');
                        } catch (error) {
                            reject(new Error(`Failed to parse release notes: ${error.message}`));
                        }
                    });
                }).on('error', reject);
            });
        } catch (error) {
            logger.error('Error fetching release notes:', error);
            return 'Error fetching release notes';
        }
    }
}

module.exports = UpdateChecker;