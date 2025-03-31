import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { FluxDispatcher } from "@webpack/common";
import { findByPropsLazy } from "@webpack";
import { Settings } from "@api/settings";
import { OptionType } from "@utils/types";
import { ApplicationCommandInputType, ApplicationCommandOptionType, registerCommand } from "@api/Commands";

// Module that contains status updating functions
const StatusUpdateModule = findByPropsLazy(["updateLocalSettings"]);

const settings = {
    statuses: {
        type: OptionType.STRING,
        description: "Statuses to rotate through (one per line)",
        default: "Coding something cool...\nPlaying with Vencord plugins\nAFK - be back soon!",
    },
    interval: {
        type: OptionType.NUMBER,
        description: "Interval between status changes (in seconds)",
        default: 5,
    },
    randomize: {
        type: OptionType.BOOLEAN,
        description: "Randomize status order",
        default: false,
    }
};

let statusInterval: NodeJS.Timeout | null = null;
let currentStatusIndex = 0;
let statusList: string[] = [];

export default definePlugin({
    name: "StatusRotator",
    description: "Automatically rotates your custom status at defined intervals",
    authors: [Devs.tiso],
    settings,
    
    start() {
        this.updateStatusList();
        this.startRotation();
        this.registerSlashCommands();
        
        Settings.addChangeListener(this.name, () => {
            this.updateStatusList();
            this.restartRotation();
        });
    },
    
    stop() {
        if (statusInterval) {
            clearInterval(statusInterval);
            statusInterval = null;
        }
        
        Settings.removeChangeListener(this.name);
    },
    
    updateStatusList() {
        const statusText = Settings.plugins.StatusRotator.statuses;
        statusList = statusText.split("\n").filter(s => s.trim() !== "");
        
        if (currentStatusIndex >= statusList.length) {
            currentStatusIndex = 0;
        }
    },
    
    updateStatus(status: string) {
        StatusUpdateModule.updateLocalSettings({
            customStatus: { text: status }
        });
    },
    
    startRotation() {
        if (statusList.length === 0) return;
        
        this.updateStatus(statusList[currentStatusIndex]);
        
        const intervalSeconds = Settings.plugins.StatusRotator.interval;
        statusInterval = setInterval(() => {
            const isRandomize = Settings.plugins.StatusRotator.randomize;
            
            if (isRandomize) {
                let nextIndex;
                do {
                    nextIndex = Math.floor(Math.random() * statusList.length);
                } while (statusList.length > 1 && nextIndex === currentStatusIndex);
                currentStatusIndex = nextIndex;
            } else {
                currentStatusIndex = (currentStatusIndex + 1) % statusList.length;
            }
            
            this.updateStatus(statusList[currentStatusIndex]);
        }, intervalSeconds * 1000);
    },
    
    restartRotation() {
        if (statusInterval) {
            clearInterval(statusInterval);
        }
        this.startRotation();
    },

    registerSlashCommands() {
        registerCommand({
            name: "current-statuses",
            description: "View your current status rotation configuration",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [],
            execute: (args, ctx) => {
                if (statusList.length === 0) {
                    return {
                        content: "⚠️ You don't have any statuses configured. Add some in the StatusRotator plugin settings!"
                    };
                }

                const isRandomized = Settings.plugins.StatusRotator.randomize;
                const intervalSeconds = Settings.plugins.StatusRotator.interval;
                
                // Current status
                const currentStatus = statusList[currentStatusIndex];
                
                // Next status (only predictable in sequential mode)
                let nextStatusMessage = "";
                if (!isRandomized) {
                    const nextIndex = (currentStatusIndex + 1) % statusList.length;
                    nextStatusMessage = `\n🔄 **Next status:** "${statusList[nextIndex]}"`;
                } else {
                    nextStatusMessage = "\n🔀 **Next status:** Random (shuffle mode is enabled)";
                }
                
                // All statuses
                const allStatusesFormatted = statusList.map((status, index) => {
                    if (index === currentStatusIndex) {
                        return `**${index + 1}. "${status}" (current)**`;
                    }
                    return `${index + 1}. "${status}"`;
                }).join("\n");
                
                return {
                    content: `## Status Rotator Info
🟢 **Current status:** "${currentStatus}"${nextStatusMessage}
⏱️ **Rotation interval:** ${intervalSeconds} seconds
${isRandomized ? "🔀 **Mode:** Shuffle (random order)" : "🔄 **Mode:** Sequential"}

### All Configured Statuses:
${allStatusesFormatted}`
                };
            }
        });
    }
});
