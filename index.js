var vgaMem = Array(76800).fill(0)
function updateVGA() {
    const ctx = document.getElementById('vga').getContext('2d')
    for (let i = 0; i < 76800; i++) {
        ctx.fillStyle = (vgaMem[i] === 1) ? '#ffffff' : '#000000'
        ctx.fillRect(i % 320, Math.floor(i / 320), 1, 1)
    }
}
document.addEventListener('DOMContentLoaded', updateVGA)

var vm = new Vue({
    el: '#app',
    data: {
        pc: 0,
        counter: 0,
        irM: 0,
        irL: 0,
        reg: Array(32).fill(0),
        mem: Array(65536).fill(0),
        memPage: 0,
        showLoad: false,
        loadData: '',
        loadError: '',
        seg: 0,
        uartTransmit: '',
        flag: {
            lt: 0,
            eq: 0
        },
        auto: false,
        autoHandler: null,
        pcStack: [],
        stack: []
    },
    methods: {
        lastPage() {
            this.memPage = 255
        },
        nextPage() {
            if (this.memPage < 255)
                this.memPage++
        },
        prevPage() {
            if (this.memPage > 0)
                this.memPage--
        },
        firstPage() {
            this.memPage = 0
        },
        openModal() {
            this.showLoad = true
        },
        closeModal() {
            this.showLoad = false
        },
        load() {
            let data = this.loadData.split('\n')
            for (let i = 0; i < data.length; i++) {
                if (data[i].trim().length == 0) {
                    this.mem[i] = 0
                    continue
                }
                const commentIndex = data[i].indexOf('//')
                if (commentIndex >= 0) {
                    data[i] = data[i].substr(0, commentIndex).trim()
                }
                data[i] = data[i].replace(/[_ ]/g, '')
                if (!(/^([01]{16})$/.test(data[i]))) {
                    this.loadError = 'Error on line ' + (i + 1)
                    return
                }
                this.mem[i] = parseInt(data[i], 2)
            }
            this.closeModal()
        },
        reset() {
            this.pc = 0
            this.counter = 0
            this.seg = 0
            this.pcStack = []
            this.stack = []
        },
        loadMemMap(addr) {
            if (addr >= 0xe000 && addr < 0xf2c0) {
                const index = addr - 0xe000
                return parseInt(vgaMem.slice(index * 16, index * 16 + 16).join(''), 2)
            } else {
                return this.mem[addr]
            }
        },
        storeMemMap(addr, value) {
            if (addr === 0xff) {
                this.seg = value
            } else if (addr >= 0xe000 && addr < 0xf2c0) {
                const index = addr - 0xe000
                for (let i = 0; i < 16; i++) {
                    vgaMem[index * 16 + i] = (value >> (15 - i)) % 2
                    updateVGA()
                }
            } else {
                this.mem[addr] = value
            }
        },
        toggleAuto() {
            this.auto = !this.auto
            if (this.auto) {
                this.autoHandler = setInterval(this.next, 50)
            } else {
                clearInterval(this.autoHandler)
            }
        },
        next() {
            if (this.counter === 0) {
                this.irM = this.mem[this.pc]
                this.pc = (this.pc + 1) % 65536
            } else if (this.counter === 1) {
                this.irL = this.mem[this.pc]
                this.pc = (this.pc + 1) % 65536
            } else if (this.counter === 2) {
                if (this.opcode === 1) {
                    if (this.mimm) {
                        this.reg[this.rr] = this.address
                    } else if (this.mdirect) {
                        this.reg[this.rr] = this.loadMemMap(this.address)
                    } else if (this.mregin) {
                        this.reg[this.rr] = this.loadMemMap(this.reg[this.rs])
                    }
                } else if (this.opcode === 2) {
                    if (this.mdirect) {
                        this.storeMemMap(this.address, this.reg[this.rr])
                    } else if (this.mregin) {
                        this.storeMemMap(this.reg[this.rs], this.reg[this.rr])
                    }
                } else if (this.opcode === 3) {
                    this.reg[this.rr] = this.reg[this.rs]
                } else if (this.opcode === 4) {
                    if (this.aadd) {
                        this.reg[this.rd] = this.reg[this.rr] + this.reg[this.rs]
                    } else if (this.asub) {
                        this.reg[this.rd] = this.reg[this.rr] - this.reg[this.rs]
                    } else if (this.amul) {
                        this.reg[this.rd] = this.reg[this.rr] * this.reg[this.rs]
                    } else if (this.adiv) {
                        this.reg[this.rd] = Math.floor(this.reg[this.rr] / this.reg[this.rs])
                    } else if (this.amod) {
                        this.reg[this.rd] = this.reg[this.rr] % this.reg[this.rs]
                    } else if (this.aand) {
                        this.reg[this.rd] = this.reg[this.rr] & this.reg[this.rs]
                    } else if (this.aor) {
                        this.reg[this.rd] = this.reg[this.rr] | this.reg[this.rs]
                    } else if (this.axor) {
                        this.reg[this.rd] = this.reg[this.rr] ^ this.reg[this.rs]
                    } else if (this.anot) {
                        this.reg[this.rd] = ~this.reg[this.rr]
                    } else if (this.aneg) {
                        this.reg[this.rd] = -this.reg[this.rr]
                    } else if (this.ashl) {
                        this.reg[this.rd] = this.reg[this.rr] << this.reg[this.rs]
                    } else if (this.ashr) {
                        this.reg[this.rd] = this.reg[this.rr] >> this.reg[this.rs]
                    }
                } else if (this.opcode === 5) {
                    this.flag.lt = this.reg[this.rr] < this.reg[this.rs]
                    this.flag.eq = this.reg[this.rr] === this.reg[this.rs]
                } else if (this.opcode === 6) {
                    if (this.shouldJump) {
                        this.pc = this.address
                    }
                } else if (this.opcode === 7) {
                    this.pcStack.push(this.pc)
                    this.pc = this.address
                } else if (this.opcode === 8) {
                    this.pc = this.pcStack.pop()
                } else if (this.opcode === 9) {
                    if (this.shouldJump) {
                        this.pc = (this.pc + this.address) & 0xffff
                    }
                } else if (this.opcode === 10) {
                    this.stack.push(this.reg[this.rr])
                } else if (this.opcode === 11) {
                    this.reg[this.rr] = this.stack.pop()
                }
            }
            this.counter = (this.counter + 1) % 4
        }
    },
    computed: {
        address() {
            return this.irL
        },
        rr() {
            return (this.irM >> 5) & 0x1f
        },
        rs() {
            return this.irM & 0x1f
        },
        rd() {
            return (this.irL >> 11) & 0x1f
        },
        opcode() {
            return this.irM >> 12
        },
        memOpt() {
            return (this.irM >> 10) & 0x3
        },
        aluMode() {
            return (this.irL) & 0xf
        },
        jmpMode() {
            return (this.irM >> 9) & 0x7
        },
        mimm() {
            return this.memOpt === 0
        },
        mdirect() {
            return this.memOpt === 1
        },
        mregin() {
            return this.memOpt === 2
        },
        aadd() {
            return this.aluMode === 1
        },
        asub() {
            return this.aluMode === 2
        },
        amul() {
            return this.aluMode === 3
        },
        adiv() {
            return this.aluMode === 4
        },
        amod() {
            return this.aluMode === 5
        },
        aand() {
            return this.aluMode === 6
        },
        aor() {
            return this.aluMode === 7
        },
        axor() {
            return this.aluMode === 8
        },
        anot() {
            return this.aluMode === 9
        },
        aneg() {
            return this.aluMode === 10
        },
        ashl() {
            return this.aluMode === 11
        },
        ashr() {
            return this.aluMode === 12
        },
        jmp() {
            return this.jmpMode === 0
        },
        jeq() {
            return this.jmpMode === 1
        },
        jne() {
            return this.jmpMode === 2
        },
        jlt() {
            return this.jmpMode === 3
        },
        jle() {
            return this.jmpMode === 4
        },
        jgt() {
            return this.jmpMode === 5
        },
        jge() {
            return this.jmpMode === 6
        },
        shouldJump() {
            return this.jmp || (this.jeq && this.flag.eq) || (this.jne && !this.flag.eq) ||
                (this.jlt && this.flag.lt) || (this.jle && (this.flag.lt || this.flag.eq)) ||
                (this.jgt && !this.flag.lt && !this.flag.eq) || (this.jge && !this.flag.lt)
        },
        opcodeStr() {
            if (this.counter < 2) {
                return ''
            }
            switch (this.opcode) {
                case 1: return 'load'
                case 2: return 'store'
                case 3: return 'move'
                case 4:
                    switch (this.aluMode) {
                        case 1: return 'add'
                        case 2: return 'sub'
                        case 3: return 'mul'
                        case 4: return 'div'
                        case 5: return 'mod'
                        case 6: return 'and'
                        case 7: return 'or'
                        case 8: return 'xor'
                        case 9: return 'not'
                        case 10: return 'neg'
                        case 11: return 'shl'
                        case 12: return 'shr'
                        default: return 'unknown alu'
                    }
                case 5: return 'cmp'
                case 6: return 'jmp'
                case 7: return 'call'
                case 8: return 'ret'
                case 9: return 'brn'
                case 10: return 'push'
                case 11: return 'pop'
                default: return 'unknown op'
            }
        }
    }
})
