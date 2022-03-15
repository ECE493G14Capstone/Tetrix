import { Socket } from "socket.io-client";
import { TetrominoType } from "common/TetrominoType";
import { Tetromino } from "./Tetromino";
import { BOARD_SIZE } from "common/shared";
import { ToServerEvents, ToClientEvents } from "common/messages/game";
import { cloneDeep } from "lodash";

type GameSocket = Socket<ToClientEvents, ToServerEvents>;

export class GameState {
    // used for synchronization. not related to rendering (no sprites, scene, phaser3 stuff)
    socket: GameSocket;

    // board contains all placed monominoes (tiles)
    board: Array<Array<TetrominoType | null>>;

    // synced to server
    currentTetromino: Tetromino;
    // synced from server, ordered by increasing, circular player numbers
    // i.e. if you are player 1, these are of player 2, then 3, then 0
    otherTetrominoes: Array<Tetromino>;
    playerId!: 0 | 1 | 2 | 3;

    private newBoard() {
        const board = new Array(BOARD_SIZE);
        for (let r = 0; r < BOARD_SIZE; r++) {
            board[r] = new Array(BOARD_SIZE).fill(null);
        }

        const centerTopLeft = BOARD_SIZE / 2 - 1;
        board[centerTopLeft][centerTopLeft] = TetrominoType.O;
        board[centerTopLeft + 1][centerTopLeft] = TetrominoType.O;
        board[centerTopLeft][centerTopLeft + 1] = TetrominoType.O;
        board[centerTopLeft + 1][centerTopLeft + 1] = TetrominoType.O;
        return board;
    }

    private getPlayerIndex(playerId: number) {
        return (3 - this.playerId + playerId) % 4;
    }

    constructor(socket: GameSocket) {
        this.socket = socket;
        this.board = this.newBoard();

        this.currentTetromino = new Tetromino(TetrominoType.T);
        // other player's moving piece, TODO this is synchronized with the server
        // how they are rendered is not concerned.
        this.otherTetrominoes = [
            // FIXME not good?
            new Tetromino(TetrominoType.T),
            new Tetromino(TetrominoType.T),
            new Tetromino(TetrominoType.T),
        ];

        // initial rotation
        this.otherTetrominoes.map((tetro, i) => {
            tetro.setRotatedPosition(tetro.position, i + 1);
            tetro.setRotation(i + 1);
        });

        this.socket.on("initPlayer", (playerId) => {
            this.playerId = playerId;
        });

        this.socket.on("playerMove", (playerId, state) => {
            const i = this.getPlayerIndex(playerId);
            Tetromino.updateFromState(this.otherTetrominoes[i], state, i + 1);
        });

        this.socket.on("playerPlace", (playerId, state) => {
            // place the tetro on our board
            const i = this.getPlayerIndex(playerId);
            const tetroToPlace = this.otherTetrominoes[i];
            Tetromino.updateFromState(tetroToPlace, state, i + 1);
            this.placeTetromino(tetroToPlace);
            this.otherTetrominoes[i] = tetroToPlace;

            // if the other tetromino is bumping into us, freeze ours too.
            if (
                this.adjacentWithPlayers(this.currentTetromino, [
                    this.otherTetrominoes[i],
                ])
            ) {
                this.emitAndPlaceCurrentTetromino();
            }
        });
    }

    public emitPlayerMove() {
        this.socket.emit(
            "playerMove",
            this.playerId,
            this.currentTetromino.reportState()
        );
    }

    public emitAndPlaceCurrentTetromino() {
        // place on board and emit events to the server
        this.socket.emit(
            "playerPlace",
            this.playerId,
            this.currentTetromino.reportState()
        );
        this.placeTetromino(this.currentTetromino);
        // start a new tetromino from the top
        this.currentTetromino.respawn();
        // broadcast new tetromino position
        this.emitPlayerMove();
    }

    public placeTetromino(tetromino: Tetromino) {
        tetromino.tiles.forEach(([row, col]) => {
            this.board[row][col] = tetromino.type;
        });
    }

    public moveIfCan(
        movement: (tetro: Tetromino) => Tetromino | void
    ): boolean {
        let newTetro: Tetromino = cloneDeep(this.currentTetromino);

        // look-ahead for the next tetromino state after movement
        newTetro = movement(newTetro) || newTetro;

        if (
            this.overlapWithBoard(newTetro) ||
            this.overlapWithPlayers(newTetro, this.otherTetrominoes)
        ) {
            return false;
        }

        this.currentTetromino.position = newTetro.position;
        this.currentTetromino.tiles = newTetro.tiles;
        this.currentTetromino.rotation = newTetro.rotation;
        this.currentTetromino.type = newTetro.type;
        return true;
    }

    /**
     * check against static board, see if newTetro is overlapping with static monominoes placed on board
     * @returns boolean - if `newTetro` overlaps with any blocks on the board
     */
    private overlapWithBoard(newTetro: Tetromino): boolean {
        return newTetro.tiles.some(([row, col]) => {
            return this.board[row][col] != null;
        });
    }

    /**
     * check against other players' tetrominoes: see if newTetro is overlapping with other existing players
     * @returns boolean - if `newTetro` overlaps with any of the `tetrominoes`
     */
    private overlapWithPlayers(
        newTetro: Tetromino,
        tetrominoes: Array<Tetromino>
    ): boolean {
        return tetrominoes.some((tetro) => {
            // if the bounding boxes are more than the-maximum-"manhattan distance" away
            const isFarAway =
                Math.abs(tetro.position[0] - newTetro.position[0]) +
                    Math.abs(tetro.position[1] - newTetro.position[1]) >
                8; // 8 is twice the max width of a tetromino bounding box
            if (isFarAway) {
                return false;
            }

            // if newTetro has overlapping monominoes with those tetro
            return tetro.tiles.some(([row, col]) => {
                return newTetro.tiles.some(
                    ([newRow, newCol]) => newRow === row && newCol === col
                );
            });
        });
    }

    /**
     * Returns if `tetro` is adjacent to any of the tetrominoes in the `tetrominoes` list
     * @param tetro - The tetromino that is supposedly "currentTetromino", but can be any tetromino to be tested
     * @param tetrominoes - The array of tetrominoes to be scanned through and looked for adjacentness
     */
    private adjacentWithPlayers(
        tetro: Tetromino,
        tetrominoes: Array<Tetromino>
    ): boolean {
        // No out of bounds check because overlapWithPlayers doesn't index board
        const expandedSet = new Set(tetro.tiles);
        tetro.tiles.forEach(([row, col]) => {
            expandedSet.add([row + 1, col]);
            expandedSet.add([row - 1, col]);
            expandedSet.add([row, col + 1]);
            expandedSet.add([row, col - 1]);
        });

        const expandedTetro = cloneDeep(tetro);
        expandedTetro.tiles = Array.from(expandedSet);

        // if the expanded tetromino is overlapping, then it's definitely adjacent, if not actually overlapping. (We don't have to care about excluding the actually overlapped case because that handles more scenarios when synchronization is not ideal.)
        return this.overlapWithPlayers(expandedTetro, tetrominoes);
    }
}
