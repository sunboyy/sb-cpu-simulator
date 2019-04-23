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
            return this.mem[addr]
        },
        storeMemMap(addr, value) {
            if (addr === 0xff) {
                this.seg = value
            } else {
                this.mem[addr] = value
            }
        },
        toggleAuto() {
            this.auto = !this.auto
            if (this.auto) {
                this.autoHandler = setInterval(this.next, 40)
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
                if (this.iload) {
                    if (this.mimm) {
                        this.reg[this.rr] = this.address
                    } else if (this.mdirect) {
                        this.reg[this.rr] = this.loadMemMap(this.address)
                    } else if (this.mregin) {
                        this.reg[this.rr] = this.loadMemMap(this.reg[this.rs])
                    }
                } else if (this.istore) {
                    if (this.mdirect) {
                        this.storeMemMap(this.address, this.reg[this.rr])
                    } else if (this.mregin) {
                        this.storeMemMap(this.reg[this.rs], this.reg[this.rr])
                    }
                } else if (this.imove) {
                    this.reg[this.rr] = this.reg[this.rs]
                } else if (this.ialu) {
                    if (this.aadd) {
                        this.reg[this.rd] = this.reg[this.rr] + this.reg[this.rs]
                    } else if (this.asub) {
                        this.reg[this.rd] = this.reg[this.rr] - this.reg[this.rs]
                    } else if (this.amul) {
                        this.reg[this.rd] = this.reg[this.rr] * this.reg[this.rs]
                    } else if (this.adiv) {
                        this.reg[this.rd] = this.reg[this.rr] / this.reg[this.rs]
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
                    }
                } else if (this.icmp) {
                    this.flag.lt = this.reg[this.rr] < this.reg[this.rs]
                    this.flag.eq = this.reg[this.rr] === this.reg[this.rs]
                } else if (this.ijmp) {
                    if (this.shouldJump) {
                        this.pc = this.address
                    }
                } else if (this.icall) {
                    this.pcStack.push(this.pc)
                    this.pc = this.address
                } else if (this.iret) {
                    this.pc = this.pcStack.pop()
                } else if (this.ibrn) {
                    if (this.shouldJump) {
                        this.pc = (this.pc + this.address) & 0xffff
                    }
                } else if (this.ipush) {
                    this.stack.push(this.reg[this.rr])
                } else if (this.ipop) {
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
        iload() {
            return this.opcode === 1
        },
        istore() {
            return this.opcode === 2
        },
        imove() {
            return this.opcode === 3
        },
        ialu() {
            return this.opcode === 4
        },
        icmp() {
            return this.opcode === 5
        },
        ijmp() {
            return this.opcode === 6
        },
        icall() {
            return this.opcode === 7
        },
        iret() {
            return this.opcode === 8
        },
        ibrn() {
            return this.opcode === 9
        },
        ipush() {
            return this.opcode === 10
        },
        ipop() {
            return this.opcode === 11
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
        }
    }
})
