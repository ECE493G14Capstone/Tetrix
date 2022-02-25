import Phaser from "phaser";
import { GameState } from "../GameState";
import { BOARD_SIZE } from "common/shared";
import { SharedState } from "..";
import { Socket } from "socket.io-client";

import {
    ToClientEvents,
    ToServerEvents,
} from "common/messages/sceneWaitingRoom";
import { WebFontFile } from "../plugins/WebFontFile";

type SocketWaitingRoom = Socket<ToClientEvents, ToServerEvents>;

export class SceneWaitingRoom extends Phaser.Scene {
    private playersNeededText!: Phaser.GameObjects.Text;
    private button!: Phaser.GameObjects.Text;
    private gameState!: GameState;
    private socket!: SocketWaitingRoom;
    private sharedData!: SharedState;

    constructor() {
        super({
            key: "SceneWaitingRoom",
        });
    }

    init(data: SharedState) {
        this.sharedData = data;
        this.gameState = data.gameState;
        this.socket = data.socket;
        this.initListeners();
    }

    preload() {
        this.load.addFile(new WebFontFile(this.load, "VT323"));
    }

    create() {
        this.add
            .text(
                BOARD_SIZE * 2.5,
                BOARD_SIZE * 5,
                "A new game is starting soon",
                {
                    fontSize: "52px",
                    fontFamily: "VT323",
                }
            )
            .setTint(0xff0000);
        this.add
            .text(
                BOARD_SIZE * 4.5,
                BOARD_SIZE * 6.5,
                "Click the button below to join!",
                { fontSize: "32px", fontFamily: "VT323" }
            )
            .setTint(0xff0000);

        this.button = this.add
            .text(BOARD_SIZE * 6.5, BOARD_SIZE * 9, "> Join <", {
                fontSize: "82px",
                fontFamily: "VT323",
            })
            .setTint(0x53bb74)
            .setInteractive({ useHandCursor: true })
            .on("pointerover", () => {
                this.isHovered(this.button, true);
            })
            .on("pointerout", () => {
                this.isHovered(this.button, false);
            })
            .on("pointerdown", () => {
                this.requestJoinGame();
            });

        this.playersNeededText = this.add
            .text(
                BOARD_SIZE * 6.7,
                BOARD_SIZE * 12,
                "Waiting on 4 more player(s)",
                {
                    fontSize: "22px",
                    fontFamily: "VT323",
                }
            )
            .setTint(0xff0000);

        // Request the # of remaining players needed to start the game.
        this.socket.emit("requestRemainingPlayers");
    }

    initListeners() {
        this.socket.on("updateRemainingPlayers", (remainingPlayers: number) => {
            console.log("update remaining: ", remainingPlayers);
            this.playersNeededText.setText(
                `Waiting on ${remainingPlayers} more player(s)`
            );

            // Hide the join button if all player positions are occupied.
            if (remainingPlayers <= 0) {
                this.button.setText("");
            }
        });

        // If the queue is full, we should receive the signal from the server to start the game.
        this.socket.on("toSceneGameArena", () => {
            this.scene.start("SceneGameArena", this.sharedData);
        });
    }

    /**
     * Modifies the color of text based off whether a cursor is over the element.
     * @param button The text element.
     * @param isHovered Whether a cursor is hovering over it.
     */
    private isHovered(button: Phaser.GameObjects.Text, isHovered: boolean) {
        if (isHovered) {
            button.setTint(0xd4cb22);
        } else {
            button.setTint(0x53bb74);
        }
    }

    /**
     * If the join button was clicked, erase it from screen and send a request to the server to join the queue.
     */
    private requestJoinGame() {
        this.button.setText("");
        this.socket.emit("joinGame");
    }
}
