// This file extends the AdapterConfig type from "@types/iobroker"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            /** IPv4/IPv6 address or hostname of the AVR */
            ip: string;
            /** Telnet port, 23 on all AVRs; differs only behind serial-to-IP bridges */
            telnetPort: number;
            /** Poll interval in ms */
            pollInterval: number;
            /** Minimum gap between two commands in ms */
            requestInterval: number;
        }
    }
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
