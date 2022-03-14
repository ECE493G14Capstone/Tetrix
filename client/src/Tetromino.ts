import { TetrominoType } from "common/TetrominoType";
import { BOARD_SIZE } from "common/shared";
import { TetrominoState } from "common/message";
import { cloneDeep } from "lodash";

type Shape = {
    width: number;
    tiles: Array<[number, number]>;
};

export class Tetromino {
    static readonly shapes: { [key in TetrominoType]: Shape } = {
        [TetrominoType.I]: {
            width: 4,
            tiles: [
                [1, 0],
                [1, 1],
                [1, 2],
                [1, 3],
            ],
        },
        [TetrominoType.J]: {
            width: 3,
            tiles: [
                [0, 0],
                [1, 0],
                [1, 1],
                [1, 2],
            ],
        },
        [TetrominoType.L]: {
            width: 3,
            tiles: [
                [0, 2],
                [1, 0],
                [1, 1],
                [1, 2],
            ],
        },
        [TetrominoType.O]: {
            width: 2,
            tiles: [
                [0, 0],
                [0, 1],
                [1, 0],
                [1, 1],
            ],
        },
        [TetrominoType.S]: {
            width: 3,
            tiles: [
                [0, 1],
                [0, 2],
                [1, 0],
                [1, 1],
            ],
        },
        [TetrominoType.T]: {
            width: 3,
            tiles: [
                [0, 1],
                [1, 0],
                [1, 1],
                [1, 2],
            ],
        },
        [TetrominoType.Z]: {
            width: 3,
            tiles: [
                [0, 0],
                [0, 1],
                [1, 1],
                [1, 2],
            ],
        },
    };

    /**
     * @param coords A `[row, column]` coordinate pair
     * @param size The grid size in which the coordinates exist
     * @param ccRotations The number of clockwise rotations to perform
     * @returns The rotated coordinates
     */
    static rotateCoords(
        coords: [number, number],
        size: number,
        ccRotations: number
    ): [number, number] {
        const maxCoord = size - 1;
        switch (ccRotations % 4) {
            case 1: // 90 degree clockwise
                return [coords[1], maxCoord - coords[0]];
            case 2: // 180 degree
                return [maxCoord - coords[0], maxCoord - coords[1]];
            case 3: // 90 degree counterclockwise
                return [maxCoord - coords[1], coords[0]];
            default:
                // 0 degree
                return coords;
        }
    }

    type: TetrominoType;
    position: [number, number];
    rotation: 0 | 1 | 2 | 3;
    tiles: Array<[number, number]>;

    constructor(type: TetrominoType) {
        this.type = type;
        this.tiles = cloneDeep(Tetromino.shapes[type].tiles);
        this.position = [
            0,
            Math.round((BOARD_SIZE - Tetromino.shapes[type].width) / 2),
        ];
        this.rotation = 0; // default (no rotation)
    }

    respawn() {
        // TODO generate from a sequence iterator (another singleton class?)
        // use respawn instead of `new Tetromino` because right now rendered tetromino will lose reference if inner is created anew. FIXME this is not true when using extension style rendered tetromino
        this.type = this.type | TetrominoType.T;
        this.tiles = cloneDeep(Tetromino.shapes[this.type].tiles);
        this.position = [
            0,
            Math.round((BOARD_SIZE - Tetromino.shapes[this.type].width) / 2),
        ];
        this.rotation = 0; // default (no rotation)
    }

    reportState(): TetrominoState {
        return {
            type: this.type,
            position: this.position,
            rotation: this.rotation,
        };
    }

    static updateFromState(
        tetromino: Tetromino,
        state: TetrominoState,
        ccRotations: number
    ) {
        tetromino.setType(state.type);
        tetromino.setRotatedPosition(state.position, ccRotations);
        tetromino.setRotation(ccRotations + state.rotation);
    }

    setType(type: TetrominoType) {
        if (this.type == type) {
            return;
        }
        this.type = type;
        this.tiles = cloneDeep(Tetromino.shapes[type].tiles);
    }

    setRotatedPosition(position: [number, number], ccRotations: number) {
        ccRotations %= 4;
        let [row, col] = Tetromino.rotateCoords(
            position,
            BOARD_SIZE,
            ccRotations
        );
        // Compensate for position needing to be at top left
        const adjustment = Tetromino.shapes[this.type].width - 1;
        if (ccRotations == 1 || ccRotations == 2) {
            col -= adjustment;
        }
        if (ccRotations == 3 || ccRotations == 2) {
            row -= adjustment;
        }
        this.position = [row, col];
    }

    setRotation(rotation: number) {
        if (this.rotation == rotation % 4) {
            return;
        }
        for (let i = 0; i < this.tiles.length; i++) {
            this.tiles[i] = Tetromino.rotateCoords(
                this.tiles[i],
                Tetromino.shapes[this.type].width,
                4 - this.rotation + rotation // circular distance
            );
        }
        this.rotation = <0 | 1 | 2 | 3>(rotation % 4);
    }

    static rotateCW(tetromino: Tetromino) {
        tetromino.setRotation(tetromino.rotation + 1);
    }

    static rotateCCW(tetromino: Tetromino) {
        tetromino.setRotation(4 + tetromino.rotation + 1);
    }

    static fall(tetromino: Tetromino) {
        // fall down by 1
        tetromino.position[0] += 1;
    }

    static slide(direction: -1 | 1): (tetro: Tetromino) => void {
        // move left/right by 1
        return (tetromino) => {
            tetromino.position[1] += direction;
        };
    }
}
