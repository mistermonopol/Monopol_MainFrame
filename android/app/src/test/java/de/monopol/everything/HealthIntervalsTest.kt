package de.monopol.everything

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.*

class HealthIntervalsTest {
    @Test fun overlappingSleepDoesNotDoubleCount() {
        val start = Instant.parse("2026-10-31T22:00:00Z")
        val result = mergeIntervals(listOf(start to start.plusSeconds(7200), start.plusSeconds(3600) to start.plusSeconds(10800)))
        assertEquals(listOf(start to start.plusSeconds(10800)), result)
    }
    @Test fun berlinDaysRespectDst() {
        val day = LocalDate.of(2026, 10, 25)
        val zone = ZoneId.of("Europe/Berlin")
        assertEquals(25, Duration.between(day.atStartOfDay(zone), day.plusDays(1).atStartOfDay(zone)).toHours().toInt())
    }
}
