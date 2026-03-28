pub struct MatchEscrow {
    pub match_id: String,
    pub host: String,
    pub guest: Option<String>,
    pub amount: u64,
    pub winner: Option<String>,
    pub settled: bool,
}

impl MatchEscrow {
    pub fn create(match_id: String, host: String, amount: u64) -> Self {
        Self {
            match_id,
            host,
            guest: None,
            amount,
            winner: None,
            settled: false,
        }
    }

    pub fn join(&mut self, guest: String) {
        self.guest = Some(guest);
    }

    pub fn settle(&mut self, winner: String) {
        self.winner = Some(winner);
        self.settled = true;
    }
}